import { NextRequest } from "next/server";
import { spawn } from "child_process";
import path from "path";

export const maxDuration = 300; // 5 minute timeout

export async function POST(request: NextRequest) {
  const { prompt, sandboxId } = await request.json();

  if (!prompt) {
    return new Response(JSON.stringify({ error: "Prompt is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const send = (data: string) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          isClosed = true;
        }
      };

      const close = () => {
        if (isClosed) return;
        isClosed = true;
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      try {
        const projectRoot = path.resolve(process.cwd(), "../..");
        const scriptPath = path.join(projectRoot, "packages", "tools", "src", "generate-room-cli.ts");

        send(JSON.stringify({ event: "status", message: "Analyzing your request..." }));

        // Build the command
        const fullCommand = `npx tsx "${scriptPath}" --prompt "${prompt.replace(/"/g, '\\"')}"${sandboxId ? ` --sandbox "${sandboxId}"` : ""}`;

        const child = spawn("sh", ["-c", fullCommand], {
          cwd: projectRoot,
          env: { ...process.env },
        });

        let buffer = "";

        child.stdout.on("data", (data) => {
          buffer += data.toString();

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.trim()) {
              try {
                JSON.parse(line);
                send(line);
              } catch {
                // Not JSON, skip
              }
            }
          }
        });

        child.stderr.on("data", (data) => {
          console.error("[Generate Room stderr]:", data.toString());
        });

        child.on("close", (code) => {
          if (buffer.trim()) {
            try {
              JSON.parse(buffer);
              send(buffer);
            } catch {
              // Not JSON, skip
            }
          }

          if (code !== 0) {
            send(JSON.stringify({ event: "error", message: `Script exited with code ${code}` }));
          }

          send("[DONE]");
          close();
        });

        child.on("error", (error) => {
          send(JSON.stringify({ event: "error", message: error.message }));
          close();
        });

      } catch (error) {
        send(JSON.stringify({ event: "error", message: String(error) }));
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
