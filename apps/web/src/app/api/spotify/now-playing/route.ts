import { NextRequest, NextResponse } from "next/server";

// Mock tracks for demo mode
const MOCK_TRACKS = [
  {
    name: "Neon Lights",
    artist: "Synthwave Dreams",
    album: "Retrowave Collection",
    albumArt: "https://picsum.photos/seed/album1/300/300",
    uri: "spotify:track:mock1",
    externalUrl: "https://open.spotify.com",
  },
  {
    name: "Digital Horizon",
    artist: "Cyber Pulse",
    album: "Future Beats",
    albumArt: "https://picsum.photos/seed/album2/300/300",
    uri: "spotify:track:mock2",
    externalUrl: "https://open.spotify.com",
  },
  {
    name: "Midnight Drive",
    artist: "Lo-Fi Station",
    album: "Chill Vibes",
    albumArt: "https://picsum.photos/seed/album3/300/300",
    uri: "spotify:track:mock3",
    externalUrl: "https://open.spotify.com",
  },
];

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid authorization header" },
      { status: 401 }
    );
  }

  const accessToken = authHeader.substring(7);

  // Mock mode - return random mock track
  if (accessToken.startsWith("mock_token")) {
    const randomTrack = MOCK_TRACKS[Math.floor(Math.random() * MOCK_TRACKS.length)];
    return NextResponse.json({
      isPlaying: true,
      track: randomTrack,
      mock: true,
    });
  }

  try {
    const response = await fetch(
      "https://api.spotify.com/v1/me/player/currently-playing",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // 204 = no content (nothing playing)
    if (response.status === 204) {
      return NextResponse.json({ isPlaying: false, track: null });
    }

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          { error: "Token expired", needsRefresh: true },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch now playing" },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      isPlaying: data.is_playing,
      track: data.item
        ? {
            name: data.item.name,
            artist: data.item.artists.map((a: { name: string }) => a.name).join(", "),
            album: data.item.album.name,
            albumArt: data.item.album.images[0]?.url,
            duration: data.item.duration_ms,
            progress: data.progress_ms,
            uri: data.item.uri,
            externalUrl: data.item.external_urls.spotify,
          }
        : null,
    });
  } catch (err) {
    console.error("Spotify now-playing error:", err);
    return NextResponse.json(
      { error: "Failed to fetch now playing" },
      { status: 500 }
    );
  }
}
