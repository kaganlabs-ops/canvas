import { NextRequest, NextResponse } from "next/server";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || "http://localhost:3000/api/spotify/callback";
const MOCK_MODE = !SPOTIFY_CLIENT_ID; // Auto-enable mock if no credentials

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/canvas?spotify_error=${error}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/canvas?spotify_error=no_code", request.url)
    );
  }

  // Mock mode - return fake tokens
  if (MOCK_MODE || code === "mock_code") {
    const redirectUrl = new URL("/canvas", request.url);
    redirectUrl.hash = `spotify_access_token=mock_token_${Date.now()}&spotify_refresh_token=mock_refresh&spotify_expires_in=3600&mock=true`;
    return NextResponse.redirect(redirectUrl);
  }

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    return NextResponse.redirect(
      new URL("/canvas?spotify_error=not_configured", request.url)
    );
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Spotify token error:", errorData);
      return NextResponse.redirect(
        new URL("/canvas?spotify_error=token_failed", request.url)
      );
    }

    const tokens = await tokenResponse.json();

    // Redirect back to canvas with tokens in URL fragment (client-side only)
    const redirectUrl = new URL("/canvas", request.url);
    redirectUrl.hash = `spotify_access_token=${tokens.access_token}&spotify_refresh_token=${tokens.refresh_token}&spotify_expires_in=${tokens.expires_in}`;

    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error("Spotify callback error:", err);
    return NextResponse.redirect(
      new URL("/canvas?spotify_error=unknown", request.url)
    );
  }
}
