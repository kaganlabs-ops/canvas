import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { promises as fs } from "fs";
import path from "path";

const anthropic = new Anthropic();

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SceneElement {
  id: string;
  type: string;
  content: string;
  position: { x: number; y: number };
  size: number;
  color: string;
  animation?: string;
  rotation?: number;
  opacity?: number;
  draggable?: boolean;
  [key: string]: unknown; // Allow any additional properties
}

interface Capability {
  id: string;
  name: string;
  description: string;
  handler: string; // JavaScript code as string
  createdAt: string;
  usageCount: number;
}

const CAPABILITIES_FILE = path.join(process.cwd(), "data", "capabilities.json");

async function loadCapabilities(): Promise<Capability[]> {
  try {
    const data = await fs.readFile(CAPABILITIES_FILE, "utf-8");
    return JSON.parse(data).capabilities || [];
  } catch {
    return [];
  }
}

async function saveCapability(capability: Capability): Promise<void> {
  const capabilities = await loadCapabilities();
  capabilities.push(capability);
  await fs.writeFile(
    CAPABILITIES_FILE,
    JSON.stringify({ capabilities }, null, 2)
  );
}

const SYSTEM_PROMPT = `You are a creative scene builder. Your PRIMARY job is to add visual elements to the canvas when users ask.

## IMPORTANT: Always Use Tools
When a user asks to add something (like "add a cat", "add stars", "add a mushroom"):
- ALWAYS use the add_element tool immediately
- Use type "emoji" and find the best matching emoji
- Positions are PERCENTAGES from 0-100 (e.g., x:50, y:30 = center-top)
- Keep y under 60 to avoid the chat area at the bottom
- Use appropriate sizes (20-60 is good)

## Making Things Realistic
When users want something MORE realistic, or say things like "make it real", "realistic cat", "actual image":
- Use the generate_image tool to create a real image
- This generates AI images with transparent backgrounds (cutouts)
- The image replaces the emoji version
- Tell them it takes a few seconds to generate

Example triggers for image generation:
- "make the cat realistic" → generate_image for the cat
- "add a real dog" → generate_image directly
- "I want actual photos not emojis" → use generate_image for new elements

## Your Tools
You have tools to add, remove, modify, duplicate visual elements (emojis, text, shapes), generate realistic images, AND change the background.

## Changing Background
Use modify_background to change the canvas background:
- "make the background red" → modify_background with color="#ff0000"
- "change to dots" → modify_background with type="dots"
- "remove the grid" → modify_background with type="none"
- "generate a starry sky background" → modify_background with type="image" and imagePrompt
- "bigger grid" → modify_background with size=60

## IMPORTANT: Creating New Capabilities
When a user asks for something you CAN'T do with existing tools:
1. Use the \`create_capability\` tool to define new functionality
2. Tell the user: "You're the first to ask for this! Creating it now..."
3. The capability will be available instantly for this user and all future users

## What You Can Create
You can create ANY visual/interactive capability:
- Click actions (show popup, play sound, navigate, transform)
- New element types (particles, gradients, images, videos)
- Physics behaviors (gravity, collision, follow cursor)
- Animations (custom keyframes, sequences)
- Interactions (hover effects, drag behaviors)
- Audio (background music, sound effects)
- And anything else the user imagines!

## How to Create Capabilities
When creating, you write JavaScript that will run in the browser. The code receives:
- \`element\`: The scene element being acted on
- \`elements\`: All elements in the scene
- \`setElements\`: Function to update elements
- \`event\`: The triggering event (if any)
- \`spotify\`: Spotify context with:
  - \`spotify.isConnected\`: boolean - whether user has connected Spotify
  - \`spotify.track\`: current track info { name, artist, album, albumArt } or null
  - \`spotify.connect()\`: function to start Spotify OAuth
  - \`spotify.fetchNowPlaying()\`: function to refresh current track
  - \`spotify.control(action)\`: function to control playback ('play', 'pause', 'next', 'previous')

Example capability for "click to show trippy effect":
\`\`\`javascript
// This runs when element is clicked
const colors = ['#ff00ff', '#00ffff', '#ffff00', '#ff0000'];
const newElements = [];
for (let i = 0; i < 20; i++) {
  newElements.push({
    id: 'particle-' + Date.now() + '-' + i,
    type: 'emoji',
    content: ['✨', '🌀', '💫', '🔮'][Math.floor(Math.random() * 4)],
    position: {
      x: element.position.x + (Math.random() - 0.5) * 40,
      y: element.position.y + (Math.random() - 0.5) * 40
    },
    size: 20 + Math.random() * 30,
    color: colors[Math.floor(Math.random() * colors.length)],
    animation: 'pulse',
    opacity: 1,
    draggable: false
  });
}
setElements(prev => [...prev, ...newElements]);
// Auto-remove after 2 seconds
setTimeout(() => {
  setElements(prev => prev.filter(el => !el.id.startsWith('particle-')));
}, 2000);
\`\`\`

Example capability for "show now playing from Spotify":
\`\`\`javascript
// Show current Spotify track when clicked
if (!spotify.isConnected) {
  setPopup({ type: 'text', content: 'Connect Spotify first! Click the button in the top right.' });
  return;
}
if (!spotify.track) {
  spotify.fetchNowPlaying();
  setPopup({ type: 'text', content: 'Fetching what\\'s playing...' });
  return;
}
// Create a now playing widget
const widget = {
  id: 'now-playing-' + Date.now(),
  type: 'text',
  content: '♪ ' + spotify.track.name + ' - ' + spotify.track.artist,
  position: { x: element.position.x, y: Math.max(5, element.position.y - 10) },
  size: 16,
  color: '#1DB954',
  customProps: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: '8px 12px',
    borderRadius: '4px'
  },
  draggable: false
};
setElements(prev => [...prev, widget]);
// Auto-remove after 5 seconds
setTimeout(() => {
  setElements(prev => prev.filter(el => el.id !== widget.id));
}, 5000);
\`\`\`

## Guidelines
- Be creative and generous with visuals
- When creating capabilities, make them reusable
- Keep responses SHORT (1-2 sentences)
- Always try to fulfill what the user imagines`;

const tools: Anthropic.Tool[] = [
  {
    name: "add_element",
    description: "Add a visual element to the scene",
    input_schema: {
      type: "object" as const,
      properties: {
        type: { type: "string", enum: ["emoji", "text", "shape"] },
        content: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        size: { type: "number" },
        color: { type: "string" },
        animation: { type: "string", enum: ["float", "pulse", "spin", "bounce", "none"] },
        draggable: { type: "boolean" },
        customProps: {
          type: "object",
          description: "Any additional properties for the element"
        },
      },
      required: ["type", "content", "x", "y", "size"],
    },
  },
  {
    name: "remove_elements",
    description: "Remove elements from the scene",
    input_schema: {
      type: "object" as const,
      properties: {
        target: { type: "string", enum: ["all", "last", "matching"] },
        match: { type: "string" },
      },
      required: ["target"],
    },
  },
  {
    name: "modify_elements",
    description: "Modify existing elements",
    input_schema: {
      type: "object" as const,
      properties: {
        target: { type: "string", enum: ["all", "last", "matching"] },
        match: { type: "string" },
        changes: { type: "object" },
      },
      required: ["target", "changes"],
    },
  },
  {
    name: "duplicate_element",
    description: "Duplicate an element",
    input_schema: {
      type: "object" as const,
      properties: {
        target: { type: "string", enum: ["last", "matching"] },
        match: { type: "string" },
        count: { type: "number" },
        scatter: { type: "boolean" },
      },
      required: ["target"],
    },
  },
  {
    name: "create_capability",
    description: "Create a NEW capability that doesn't exist yet. Use this when the user asks for something you can't do with existing tools.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Short name for the capability (e.g., 'clickToExplode', 'followCursor')",
        },
        description: {
          type: "string",
          description: "What this capability does",
        },
        trigger: {
          type: "string",
          enum: ["click", "hover", "load", "interval", "drag"],
          description: "When this capability activates",
        },
        targetElement: {
          type: "string",
          description: "Which element to attach this to ('last', or content match)",
        },
        code: {
          type: "string",
          description: "JavaScript code that runs when triggered. Has access to: element, elements, setElements, event",
        },
      },
      required: ["name", "description", "trigger", "code"],
    },
  },
  {
    name: "execute_capability",
    description: "Execute an existing capability on an element",
    input_schema: {
      type: "object" as const,
      properties: {
        capabilityName: { type: "string" },
        targetElement: { type: "string" },
      },
      required: ["capabilityName"],
    },
  },
  {
    name: "generate_image",
    description: "Generate a realistic AI image with transparent background. Use when user wants realistic/actual images instead of emojis. Takes a few seconds.",
    input_schema: {
      type: "object" as const,
      properties: {
        prompt: {
          type: "string",
          description: "Detailed description of what to generate (e.g., 'cute orange tabby cat sitting', 'red mushroom with white spots')",
        },
        targetElement: {
          type: "string",
          description: "If replacing an existing element, specify 'last' or the content to match (e.g., '🐱'). Leave empty for new element.",
        },
        x: { type: "number", description: "X position (0-100), optional if replacing existing" },
        y: { type: "number", description: "Y position (0-100), optional if replacing existing" },
        size: { type: "number", description: "Size in pixels (100-300 recommended for images)" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "modify_background",
    description: "Change the canvas background. Can set grid, dots, solid color, or generate a custom image background.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["grid", "dots", "none", "image"],
          description: "Background type: grid (lines), dots (points), none (solid), or image",
        },
        color: {
          type: "string",
          description: "Primary color (hex like #ff0000 or named color). For grid/dots this is the line/dot color.",
        },
        size: {
          type: "number",
          description: "Grid/dot spacing in pixels (20-100). Default is 40.",
        },
        opacity: {
          type: "number",
          description: "Background opacity (0.01-0.3). Default is 0.05.",
        },
        imagePrompt: {
          type: "string",
          description: "If type is 'image', describe what background image to generate.",
        },
      },
      required: [],
    },
  },
  {
    name: "finish_onboarding",
    description: "Save creation and move to world",
    input_schema: {
      type: "object" as const,
      properties: {
        roomName: { type: "string" },
      },
      required: ["roomName"],
    },
  },
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history, currentElements } = body as {
      message: string;
      history: Message[];
      currentElements: SceneElement[];
    };

    // Load existing capabilities
    const capabilities = await loadCapabilities();

    // Build context
    let context = "\n\n## Current Scene\n";
    if (currentElements.length === 0) {
      context += "Empty canvas.";
    } else {
      context += `${currentElements.length} elements:\n`;
      currentElements.forEach((el) => {
        context += `- ${el.type}: "${el.content}" at (${el.position.x}%, ${el.position.y}%)\n`;
      });
    }

    // Add available capabilities
    if (capabilities.length > 0) {
      context += "\n\n## Available Capabilities (created by users)\n";
      capabilities.forEach((cap) => {
        context += `- ${cap.name}: ${cap.description} (used ${cap.usageCount} times)\n`;
      });
    }

    const messages: Anthropic.MessageParam[] = [
      ...history.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user" as const, content: message },
    ];

    let responseText = "";
    const actions: Array<{
      type: string;
      data: Record<string, unknown>;
    }> = [];

    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT + context,
      tools,
      tool_choice: { type: "auto" },
      messages,
    });

    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter((block) => block.type === "tool_use");
      if (toolUseBlocks.length === 0) break;

      const toolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = [];

      for (const toolUse of toolUseBlocks) {
        if (toolUse.type !== "tool_use") continue;
        const input = toolUse.input as Record<string, unknown>;

        if (toolUse.name === "add_element") {
          actions.push({
            type: "add",
            data: {
              id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              type: input.type,
              content: input.content,
              position: { x: input.x, y: input.y },
              size: input.size || 40,
              color: input.color || "#33ff00",
              animation: input.animation || "none",
              draggable: input.draggable !== false,
              ...(input.customProps as Record<string, unknown> || {}),
            },
          });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `Added ${input.type}: ${input.content}`,
          });
        } else if (toolUse.name === "remove_elements") {
          actions.push({
            type: "remove",
            data: { target: input.target, match: input.match },
          });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `Removed elements`,
          });
        } else if (toolUse.name === "modify_elements") {
          actions.push({
            type: "modify",
            data: { target: input.target, match: input.match, changes: input.changes },
          });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `Modified elements`,
          });
        } else if (toolUse.name === "duplicate_element") {
          actions.push({
            type: "duplicate",
            data: {
              target: input.target,
              match: input.match,
              count: input.count || 1,
              scatter: input.scatter !== false,
            },
          });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `Duplicated element`,
          });
        } else if (toolUse.name === "create_capability") {
          // Save the new capability
          const newCapability: Capability = {
            id: `cap-${Date.now()}`,
            name: input.name as string,
            description: input.description as string,
            handler: JSON.stringify({
              trigger: input.trigger,
              code: input.code,
            }),
            createdAt: new Date().toISOString(),
            usageCount: 0,
          };
          await saveCapability(newCapability);

          // Send action to frontend to attach behavior
          actions.push({
            type: "attachCapability",
            data: {
              capabilityId: newCapability.id,
              name: input.name,
              trigger: input.trigger,
              targetElement: input.targetElement || "last",
              code: input.code,
              isNew: true,
            },
          });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `Created new capability: ${input.name}. This is now available for all users!`,
          });
        } else if (toolUse.name === "execute_capability") {
          const cap = capabilities.find((c) => c.name === input.capabilityName);
          if (cap) {
            const handler = JSON.parse(cap.handler);
            actions.push({
              type: "attachCapability",
              data: {
                capabilityId: cap.id,
                name: cap.name,
                trigger: handler.trigger,
                targetElement: input.targetElement || "last",
                code: handler.code,
                isNew: false,
              },
            });
            // Update usage count
            cap.usageCount++;
          }
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: cap ? `Attached capability: ${cap.name}` : `Capability not found`,
          });
        } else if (toolUse.name === "generate_image") {
          // Call the image generation API
          const prompt = input.prompt as string;
          const targetElement = input.targetElement as string | undefined;

          // Send startGenerating action first so UI shows loading state
          if (targetElement) {
            actions.push({
              type: "startGenerating",
              data: {
                target: targetElement === "last" ? "last" : "matching",
                match: targetElement === "last" ? undefined : targetElement,
              },
            });
          }

          try {
            console.log("Generating image for:", prompt);
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            const imageResponse = await fetch(`${baseUrl}/api/canvas/generate-image`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt, style: "cutout" }),
            });

            if (!imageResponse.ok) {
              throw new Error("Image generation failed");
            }

            const { imageUrl } = await imageResponse.json();
            console.log("Generated image URL:", imageUrl);

            // If replacing existing element
            if (targetElement) {
              actions.push({
                type: "replaceWithImage",
                data: {
                  target: targetElement === "last" ? "last" : "matching",
                  match: targetElement === "last" ? undefined : targetElement,
                  imageUrl,
                  size: input.size || 150,
                },
              });
            } else {
              // Add new image element
              actions.push({
                type: "add",
                data: {
                  id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  type: "image",
                  content: imageUrl,
                  position: { x: input.x || 50, y: input.y || 30 },
                  size: input.size || 150,
                  color: "#ffffff",
                  animation: "none",
                  draggable: true,
                },
              });
            }

            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: `Generated realistic image for: ${prompt}`,
            });
          } catch (error) {
            console.error("Image generation error:", error);
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: `Failed to generate image: ${error}. Using emoji fallback.`,
            });
          }
        } else if (toolUse.name === "modify_background") {
          const bgType = input.type as string | undefined;
          const color = input.color as string | undefined;
          const size = input.size as number | undefined;
          const opacity = input.opacity as number | undefined;
          const imagePrompt = input.imagePrompt as string | undefined;

          // If generating an image background, show loading state first
          if (bgType === "image" && imagePrompt) {
            actions.push({
              type: "modifyBackground",
              data: { generating: true },
            });

            try {
              const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
              const imageResponse = await fetch(`${baseUrl}/api/canvas/generate-image`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: imagePrompt + " seamless background pattern", style: "background" }),
              });

              if (!imageResponse.ok) {
                throw new Error("Background image generation failed");
              }

              const { imageUrl } = await imageResponse.json();

              actions.push({
                type: "modifyBackground",
                data: {
                  type: "image",
                  imageUrl,
                  opacity: opacity ?? 0.3,
                  generating: false,
                },
              });

              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: `Generated custom background image: ${imagePrompt}`,
              });
            } catch (error) {
              console.error("Background image generation error:", error);
              actions.push({
                type: "modifyBackground",
                data: { generating: false },
              });
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: `Failed to generate background image: ${error}`,
              });
            }
          } else {
            // Simple background change (no image generation)
            actions.push({
              type: "modifyBackground",
              data: {
                ...(bgType && { type: bgType }),
                ...(color && { color }),
                ...(size && { size }),
                ...(opacity !== undefined && { opacity }),
              },
            });

            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: `Changed background: ${bgType || "updated"} ${color ? `color=${color}` : ""} ${size ? `size=${size}` : ""}`,
            });
          }
        } else if (toolUse.name === "finish_onboarding") {
          actions.push({
            type: "finish",
            data: { roomName: input.roomName },
          });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `Finishing onboarding`,
          });
        }
      }

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });

      response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT + context,
        tools,
        messages,
      });
    }

    const textBlock = response.content.find((b) => b.type === "text");
    responseText = textBlock?.type === "text" ? textBlock.text : "Done!";

    console.log("Execute response:", { responseText, actionsCount: actions.length, actions: JSON.stringify(actions, null, 2) });

    return NextResponse.json({ response: responseText, actions });
  } catch (error) {
    console.error("Execute error:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
