import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

export async function POST(request: NextRequest) {
  try {
    const { prompt, style = "cutout" } = await request.json();

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

    // Build prompt for transparent PNG cutout
    let fullPrompt = prompt;
    if (style === "cutout") {
      fullPrompt = `${prompt}, isolated on pure white background, cutout style, no shadows, clean edges, transparent background compatible, PNG sticker style`;
    } else if (style === "realistic") {
      fullPrompt = `${prompt}, photorealistic, high quality, detailed`;
    }

    console.log("Generating image with prompt:", fullPrompt);

    // Use Flux Schnell for fast generation
    const result = await fal.subscribe("fal-ai/flux/schnell", {
      input: {
        prompt: fullPrompt,
        image_size: "square",
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: true,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS" && update.logs) {
          update.logs.map((log) => log.message).forEach(console.log);
        }
      },
    });

    console.log("Image generation complete:", result);

    // Extract image URL from result
    const imageUrl = result.data?.images?.[0]?.url;

    if (!imageUrl) {
      console.error("No image URL in result:", result);
      return NextResponse.json(
        { error: "No image URL returned from fal.ai" },
        { status: 500 }
      );
    }

    // For cutout style, run through background removal
    let finalUrl = imageUrl;
    if (style === "cutout") {
      try {
        console.log("Removing background...");
        const bgRemoveResult = await fal.subscribe("fal-ai/birefnet", {
          input: {
            image_url: imageUrl,
          },
          logs: true,
        });

        const removedBgUrl = bgRemoveResult.data?.image?.url;
        if (removedBgUrl) {
          finalUrl = removedBgUrl;
          console.log("Background removed:", finalUrl);
        }
      } catch (bgError) {
        console.error("Background removal failed, using original:", bgError);
        // Continue with original image if bg removal fails
      }
    }

    return NextResponse.json({ imageUrl: finalUrl });
  } catch (error: unknown) {
    console.error("Image generation error:", error);

    let errorMessage = "Failed to generate image";
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
