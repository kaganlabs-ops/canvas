import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioBlob = formData.get("audio") as Blob;

    if (!audioBlob) {
      return NextResponse.json({ error: "No audio provided" }, { status: 400 });
    }

    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
      return NextResponse.json(
        { error: "REPLICATE_API_TOKEN not configured" },
        { status: 500 }
      );
    }

    // Convert audio blob to base64 data URI
    const audioBuffer = await audioBlob.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString("base64");
    const audioDataUri = `data:audio/mpeg;base64,${audioBase64}`;

    // Use the face image for lip sync
    const facePath = process.cwd() + "/public/steve-jobs-face.jpg";
    const fs = await import("fs");
    const faceBuffer = fs.readFileSync(facePath);
    const faceBase64 = faceBuffer.toString("base64");
    const faceDataUri = `data:image/jpeg;base64,${faceBase64}`;

    // Call Replicate's SadTalker model (more natural head movements)
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // SadTalker model on Replicate
        version:
          "a519cc0cfebaaeade068b23899165a11ec76aaa1d2b313d40d214f204ec957a3",
        input: {
          source_image: faceDataUri,
          driven_audio: audioDataUri,
          use_enhancer: true,
          use_eyeblink: true,
          pose_style: 0,
          size_of_image: 512,
          preprocess: "crop",
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Replicate error:", error);
      return NextResponse.json(
        { error: "Failed to start lip sync" },
        { status: 500 }
      );
    }

    const prediction = await response.json();

    // Poll for completion
    let result = prediction;
    while (result.status !== "succeeded" && result.status !== "failed") {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const pollResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${result.id}`,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
          },
        }
      );
      result = await pollResponse.json();
    }

    if (result.status === "failed") {
      console.error("Lip sync failed:", result.error);
      return NextResponse.json(
        { error: "Lip sync generation failed" },
        { status: 500 }
      );
    }

    // Return the video URL
    return NextResponse.json({ videoUrl: result.output });
  } catch (error) {
    console.error("Lip sync error:", error);
    return NextResponse.json(
      { error: "Failed to generate lip sync" },
      { status: 500 }
    );
  }
}
