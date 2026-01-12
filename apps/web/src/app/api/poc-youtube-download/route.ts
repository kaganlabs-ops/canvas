import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { fal } from "@fal-ai/client";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { youtubeUrl, startTime = 0, duration = 8 } = await request.json();

    if (!youtubeUrl) {
      return NextResponse.json(
        { error: "youtubeUrl is required" },
        { status: 400 }
      );
    }

    // Validate YouTube URL
    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!ytRegex.test(youtubeUrl)) {
      return NextResponse.json(
        { error: "Invalid YouTube URL" },
        { status: 400 }
      );
    }

    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return NextResponse.json(
        { error: "FAL_KEY not configured" },
        { status: 500 }
      );
    }

    // Create temp directory
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "yt-"));
    const outputPath = path.join(tempDir, "video.mp4");

    console.log("Downloading from YouTube:", youtubeUrl);
    console.log("Start time:", startTime, "Duration:", duration);

    // Download with yt-dlp
    // - Download section from startTime for duration seconds
    // - Scale to 720p minimum height
    // - Re-encode for compatibility
    const ytdlpCmd = `/opt/homebrew/bin/yt-dlp \
      --download-sections "*${startTime}-${startTime + duration}" \
      -f "bestvideo[height>=720]+bestaudio/best[height>=720]" \
      --merge-output-format mp4 \
      --postprocessor-args "ffmpeg:-vf scale=-2:720 -c:v libx264 -c:a aac" \
      -o "${outputPath}" \
      "${youtubeUrl}"`;

    try {
      const { stdout, stderr } = await execAsync(ytdlpCmd, { timeout: 120000 });
      console.log("yt-dlp stdout:", stdout);
      if (stderr) console.log("yt-dlp stderr:", stderr);
    } catch (dlError) {
      console.error("Download error:", dlError);
      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });
      return NextResponse.json(
        { error: "Failed to download video from YouTube" },
        { status: 500 }
      );
    }

    // Check if file exists
    if (!fs.existsSync(outputPath)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      return NextResponse.json(
        { error: "Downloaded file not found" },
        { status: 500 }
      );
    }

    // Upload to fal.ai storage
    console.log("Uploading to fal.ai storage...");
    fal.config({ credentials: falKey });

    const fileBuffer = fs.readFileSync(outputPath);
    const file = new File([fileBuffer], "youtube-clip.mp4", { type: "video/mp4" });
    const uploadedUrl = await fal.storage.upload(file);

    console.log("Uploaded to:", uploadedUrl);

    // Clean up temp files
    fs.rmSync(tempDir, { recursive: true, force: true });

    return NextResponse.json({
      url: uploadedUrl,
      message: `Downloaded ${duration}s clip starting at ${startTime}s`,
    });
  } catch (error) {
    console.error("YouTube download error:", error);
    return NextResponse.json(
      { error: "Failed to process YouTube video", details: String(error) },
      { status: 500 }
    );
  }
}
