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

    const { name, voiceId, systemPrompt, firstMessage } = await request.json();

    if (!name || !voiceId || !systemPrompt) {
      return NextResponse.json(
        { error: "name, voiceId, and systemPrompt are required" },
        { status: 400 }
      );
    }

    console.log("Creating ElevenLabs agent:", { name, voiceId });

    // Build the agent configuration
    const agentConfig = {
      name,
      conversation_config: {
        agent: {
          prompt: {
            prompt: systemPrompt,
          },
          first_message: firstMessage || `Hello! I'm ${name}. How can I help you today?`,
          language: "en",
        },
        tts: {
          voice_id: voiceId,
        },
      },
    };

    // Call ElevenLabs agent creation API
    const response = await fetch(
      "https://api.elevenlabs.io/v1/convai/agents/create",
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(agentConfig),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs agent creation error:", errorText);
      return NextResponse.json(
        { error: "Failed to create agent", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("Agent created successfully:", data);

    return NextResponse.json({
      agentId: data.agent_id,
    });
  } catch (error) {
    console.error("Agent creation error:", error);
    return NextResponse.json(
      { error: "Failed to create agent", details: String(error) },
      { status: 500 }
    );
  }
}
