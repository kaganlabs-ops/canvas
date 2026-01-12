import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

export async function POST(request: NextRequest) {
  try {
    const {
      referenceImageUrl,
      referenceVideoUrl,
      prompt,
      duration = "5",
      mode = "image" // "image" or "video"
    } = await request.json();

    if (mode === "image" && !referenceImageUrl) {
      return NextResponse.json(
        { error: "referenceImageUrl is required for image mode" },
        { status: 400 }
      );
    }

    if (mode === "video" && !referenceVideoUrl) {
      return NextResponse.json(
        { error: "referenceVideoUrl is required for video mode" },
        { status: 400 }
      );
    }

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return NextResponse.json(
        { error: "FAL_KEY not configured" },
        { status: 500 }
      );
    }

    fal.config({ credentials: falKey });

    let result;

    if (mode === "video") {
      // Video-to-Video Reference
      console.log("Starting VIDEO-to-video generation with fal.ai Kling O1...");
      console.log("Reference video:", referenceVideoUrl);
      console.log("Prompt:", prompt);

      result = await fal.subscribe("fal-ai/kling-video/o1/video-to-video/reference", {
        input: {
          prompt: prompt,
          video_url: referenceVideoUrl,
          duration: duration,
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS" && update.logs) {
            update.logs.map((log) => log.message).forEach(console.log);
          }
        },
      });
    } else {
      // Image-to-Video using Minimax (better for talking head animation)
      console.log("Starting IMAGE-to-video generation with Minimax...");
      console.log("Reference image:", referenceImageUrl);
      console.log("Prompt:", prompt);

      result = await fal.subscribe("fal-ai/minimax/video-01/image-to-video", {
        input: {
          prompt: prompt,
          image_url: referenceImageUrl,
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS" && update.logs) {
            update.logs.map((log) => log.message).forEach(console.log);
          }
        },
      });
    }

    console.log("Video generation complete:", result);

    // Extract video URL from result
    const videoUrl = result.data?.video?.url;

    if (!videoUrl) {
      console.error("No video URL in result:", result);
      return NextResponse.json(
        { error: "No video URL returned from fal.ai" },
        { status: 500 }
      );
    }

    return NextResponse.json({ videoUrl });
  } catch (error: unknown) {
    console.error("Video generation error:", error);

    // Try to extract more details from the error
    let errorMessage = "Failed to generate video";
    let errorDetails = String(error);

    if (error && typeof error === "object") {
      const err = error as { body?: unknown; message?: string; status?: number };
      if (err.body) {
        console.error("Error body:", JSON.stringify(err.body, null, 2));
        errorDetails = JSON.stringify(err.body);
      }
      if (err.message) {
        errorMessage = err.message;
      }
    }

    return NextResponse.json(
      { error: errorMessage, details: errorDetails },
      { status: 500 }
    );
  }
}
