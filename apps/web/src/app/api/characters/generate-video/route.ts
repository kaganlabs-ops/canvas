import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

export async function POST(request: NextRequest) {
  try {
    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return NextResponse.json(
        { error: "FAL_KEY not configured" },
        { status: 500 }
      );
    }

    fal.config({ credentials: falKey });

    const { imageUrl, prompt } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: "imageUrl is required" },
        { status: 400 }
      );
    }

    const videoPrompt =
      prompt ||
      "A person with a subtle, natural expression, nodding gently and looking attentive, as if listening to someone speak. Natural lighting, realistic movement.";

    console.log("Generating video from image:", { imageUrl, prompt: videoPrompt });

    // Use Minimax for image-to-video (best for talking head animation)
    const result = await fal.subscribe("fal-ai/minimax/video-01/image-to-video", {
      input: {
        prompt: videoPrompt,
        image_url: imageUrl,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS" && update.logs) {
          update.logs.map((log) => log.message).forEach(console.log);
        }
      },
    });

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

    let errorMessage = "Failed to generate video";
    let errorDetails = String(error);

    if (error && typeof error === "object") {
      const err = error as { body?: unknown; message?: string };
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
