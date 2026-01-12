import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid authorization header" },
      { status: 401 }
    );
  }

  const accessToken = authHeader.substring(7);

  // Mock mode - just return success
  if (accessToken.startsWith("mock_token")) {
    const body = await request.json();
    console.log("[Mock Spotify] Control action:", body.action);
    return NextResponse.json({ success: true, mock: true, action: body.action });
  }

  try {
    const body = await request.json();
    const { action, uri, position } = body;

    let endpoint = "https://api.spotify.com/v1/me/player";
    let method = "PUT";
    let requestBody: Record<string, unknown> | undefined;

    switch (action) {
      case "play":
        endpoint += "/play";
        if (uri) {
          // Play specific track
          requestBody = { uris: [uri] };
          if (position !== undefined) {
            requestBody.position_ms = position;
          }
        }
        break;

      case "pause":
        endpoint += "/pause";
        break;

      case "next":
        endpoint += "/next";
        method = "POST";
        break;

      case "previous":
        endpoint += "/previous";
        method = "POST";
        break;

      case "shuffle":
        endpoint += `/shuffle?state=${body.state ?? true}`;
        break;

      case "volume":
        endpoint += `/volume?volume_percent=${body.volume ?? 50}`;
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    const response = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: requestBody ? JSON.stringify(requestBody) : undefined,
    });

    // 204 = success with no content
    if (response.status === 204 || response.ok) {
      return NextResponse.json({ success: true });
    }

    if (response.status === 401) {
      return NextResponse.json(
        { error: "Token expired", needsRefresh: true },
        { status: 401 }
      );
    }

    if (response.status === 404) {
      return NextResponse.json(
        { error: "No active device found. Open Spotify on a device first." },
        { status: 404 }
      );
    }

    const errorData = await response.json().catch(() => ({}));
    return NextResponse.json(
      { error: errorData.error?.message || "Playback control failed" },
      { status: response.status }
    );
  } catch (err) {
    console.error("Spotify play error:", err);
    return NextResponse.json(
      { error: "Failed to control playback" },
      { status: 500 }
    );
  }
}
