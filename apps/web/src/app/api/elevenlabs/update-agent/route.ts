import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ELEVENLABS_API_KEY not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { agentId, conversation_config } = body;

    if (!agentId) {
      return NextResponse.json(
        { error: "agentId is required" },
        { status: 400 }
      );
    }

    console.log("Updating ElevenLabs agent:", agentId);

    // Call ElevenLabs agent update API
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${agentId}`,
      {
        method: "PATCH",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ conversation_config }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs agent update error:", errorText);
      return NextResponse.json(
        { error: "Failed to update agent", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("Agent updated successfully");

    return NextResponse.json({
      success: true,
      agent: data,
    });
  } catch (error) {
    console.error("Agent update error:", error);
    return NextResponse.json(
      { error: "Failed to update agent", details: String(error) },
      { status: 500 }
    );
  }
}

// GET - Fetch current agent configuration
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ELEVENLABS_API_KEY not configured" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json(
        { error: "agentId query param is required" },
        { status: 400 }
      );
    }

    console.log("Fetching ElevenLabs agent:", agentId);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${agentId}`,
      {
        method: "GET",
        headers: {
          "xi-api-key": apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs agent fetch error:", errorText);
      return NextResponse.json(
        { error: "Failed to fetch agent", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      agent: data,
    });
  } catch (error) {
    console.error("Agent fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent", details: String(error) },
      { status: 500 }
    );
  }
}
