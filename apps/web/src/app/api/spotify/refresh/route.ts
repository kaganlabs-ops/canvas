import { NextRequest, NextResponse } from "next/server";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

export async function POST(request: NextRequest) {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "Spotify not configured" },
      { status: 500 }
    );
  }

  try {
    const { refreshToken } = await request.json();

    if (!refreshToken) {
      return NextResponse.json(
        { error: "Missing refresh token" },
        { status: 400 }
      );
    }

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Spotify refresh error:", errorData);
      return NextResponse.json(
        { error: "Failed to refresh token" },
        { status: 400 }
      );
    }

    const tokens = await response.json();

    return NextResponse.json({
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in,
      // Spotify may return a new refresh token
      refreshToken: tokens.refresh_token || refreshToken,
    });
  } catch (err) {
    console.error("Spotify refresh error:", err);
    return NextResponse.json(
      { error: "Failed to refresh token" },
      { status: 500 }
    );
  }
}
