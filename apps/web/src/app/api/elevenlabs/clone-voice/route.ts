import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ELEVENLABS_API_KEY not configured" },
        { status: 500 }
      );
    }

    const { name, audioUrl } = await request.json();

    if (!name || !audioUrl) {
      return NextResponse.json(
        { error: "name and audioUrl are required" },
        { status: 400 }
      );
    }

    console.log("Cloning voice:", { name, audioUrl });

    // Fetch the audio file from FAL storage
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio from ${audioUrl}`);
    }
    const audioBlob = await audioResponse.blob();

    // Create form data for ElevenLabs API
    const formData = new FormData();
    formData.append("name", name);
    formData.append("files", audioBlob, "voice-sample.mp3");
    formData.append("remove_background_noise", "true");

    // Call ElevenLabs voice cloning API
    const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs voice cloning error:", errorText);
      return NextResponse.json(
        { error: "Failed to clone voice", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("Voice cloned successfully:", data);

    return NextResponse.json({
      voiceId: data.voice_id,
      requiresVerification: data.requires_verification,
    });
  } catch (error) {
    console.error("Voice cloning error:", error);
    return NextResponse.json(
      { error: "Failed to clone voice", details: String(error) },
      { status: 500 }
    );
  }
}
