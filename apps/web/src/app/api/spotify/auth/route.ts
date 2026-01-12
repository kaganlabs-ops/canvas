import { NextRequest, NextResponse } from "next/server";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || "http://localhost:3000/api/spotify/callback";
const MOCK_MODE = !SPOTIFY_CLIENT_ID; // Auto-enable mock if no credentials

const SCOPES = [
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-recently-played",
].join(" ");

export async function GET(request: NextRequest) {
  // Mock mode - return fake auth that redirects back with mock tokens
  if (MOCK_MODE) {
    const mockState = "mock_" + Math.random().toString(36).substring(2, 15);
    const origin = request.nextUrl.origin;
    const mockAuthUrl = `${origin}/api/spotify/callback?code=mock_code&state=${mockState}`;
    return NextResponse.json({ authUrl: mockAuthUrl, state: mockState, mock: true });
  }

  // Generate random state for CSRF protection
  const state = Math.random().toString(36).substring(2, 15);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: SPOTIFY_CLIENT_ID,
    scope: SCOPES,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state: state,
  });

  const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;

  // Return the auth URL and state (frontend should store state for verification)
  return NextResponse.json({ authUrl, state });
}
