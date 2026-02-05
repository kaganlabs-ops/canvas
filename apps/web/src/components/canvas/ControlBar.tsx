"use client";

import { useRouter } from "next/navigation";
import type { SpotifyAuth, SpotifyTrack, GoogleAuth, CreatedRoom, BuildingRoom } from "./types";

interface ControlBarProps {
  // Spotify
  spotifyAuth: SpotifyAuth | null;
  spotifyTrack: SpotifyTrack | null;
  isSpotifyConnecting: boolean;
  onConnectSpotify: () => void;
  onFetchNowPlaying: () => void;

  // Google
  googleAuth: GoogleAuth | null;
  isGoogleConnecting: boolean;
  onConnectGoogle: () => void;

  // Rooms
  createdRooms: CreatedRoom[];
  buildingRooms: BuildingRoom[];
  onRemoveCreatedRoom: (url: string) => void;

  // Onboarding
  onOpenOnboarding?: () => void;
}

export function ControlBar({
  spotifyAuth,
  spotifyTrack,
  isSpotifyConnecting,
  onConnectSpotify,
  onFetchNowPlaying,
  googleAuth,
  isGoogleConnecting,
  onConnectGoogle,
  createdRooms,
  buildingRooms,
  onRemoveCreatedRoom,
  onOpenOnboarding,
}: ControlBarProps) {
  const router = useRouter();

  return (
    <div className="fixed top-4 right-4 z-30 flex flex-col gap-2">
      {/* NUTZ Button - Create your agent */}
      {onOpenOnboarding && (
        <button
          onClick={onOpenOnboarding}
          className="px-3 py-1.5 text-[10px] font-mono border border-[#ff00ff] text-[#ff00ff] hover:bg-[#ff00ff]/20 transition-all animate-pulse"
          style={{ textShadow: "0 0 10px rgba(255, 0, 255, 0.5)" }}
        >
          [NUTZ]
        </button>
      )}

      {/* Steve Jobs Room Button */}
      <button
        onClick={() => router.push("/room/learn/steve-jobs-room")}
        className="px-3 py-1.5 text-[10px] font-mono border border-[#ffb000]/40 text-[#ffb000]/60 hover:border-[#ffb000] hover:text-[#ffb000] hover:bg-[#ffb000]/10 transition-all"
        style={{ textShadow: "0 0 5px rgba(255, 176, 0, 0.3)" }}
      >
        [TALK TO STEVE]
      </button>

      {/* Cyberpunk Room Button */}
      <button
        onClick={() => router.push("/rooms/cyberpunk-kreuzberg/index.html")}
        className="px-3 py-1.5 text-[10px] font-mono border border-[#00ffff]/40 text-[#00ffff]/60 hover:border-[#00ffff] hover:text-[#00ffff] hover:bg-[#00ffff]/10 transition-all"
        style={{ textShadow: "0 0 5px rgba(0, 255, 255, 0.3)" }}
      >
        [CYBERPUNK DEN]
      </button>

      {/* Spotify Button */}
      <button
        onClick={spotifyAuth ? onFetchNowPlaying : onConnectSpotify}
        disabled={isSpotifyConnecting}
        className={`px-3 py-1.5 text-[10px] font-mono border transition-all ${
          spotifyAuth
            ? "border-[#1DB954] text-[#1DB954] hover:bg-[#1DB954]/10"
            : "border-[#33ff00]/40 text-[#33ff00]/60 hover:border-[#33ff00] hover:text-[#33ff00]"
        } ${isSpotifyConnecting ? "opacity-50 cursor-wait" : ""}`}
        style={{
          textShadow: spotifyAuth ? "0 0 5px rgba(29, 185, 84, 0.5)" : "0 0 5px rgba(51, 255, 0, 0.3)",
        }}
      >
        {isSpotifyConnecting ? "[CONNECTING...]" : spotifyAuth ? "[SPOTIFY: ON]" : "[SPOTIFY: OFF]"}
      </button>

      {/* Now Playing Display */}
      {spotifyAuth && spotifyTrack && (
        <div
          className="mt-2 px-3 py-2 border border-[#1DB954]/40 bg-[#0a0a0a]/90 max-w-[200px]"
          style={{ textShadow: "0 0 5px rgba(29, 185, 84, 0.3)" }}
        >
          <div className="flex items-center gap-2">
            {spotifyTrack.albumArt && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={spotifyTrack.albumArt}
                alt="Album art"
                className="w-10 h-10 object-cover"
                style={{ filter: "drop-shadow(0 0 5px rgba(29, 185, 84, 0.3))" }}
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[#1DB954] text-[10px] font-mono truncate">{spotifyTrack.name}</p>
              <p className="text-[#1DB954]/60 text-[8px] font-mono truncate">{spotifyTrack.artist}</p>
            </div>
          </div>
        </div>
      )}

      {/* Google Button */}
      <button
        onClick={onConnectGoogle}
        disabled={isGoogleConnecting}
        className={`px-3 py-1.5 text-[10px] font-mono border transition-all ${
          googleAuth
            ? "border-[#4285F4] text-[#4285F4] hover:bg-[#4285F4]/10"
            : "border-[#33ff00]/40 text-[#33ff00]/60 hover:border-[#33ff00] hover:text-[#33ff00]"
        } ${isGoogleConnecting ? "opacity-50 cursor-wait" : ""}`}
        style={{
          textShadow: googleAuth ? "0 0 5px rgba(66, 133, 244, 0.5)" : "0 0 5px rgba(51, 255, 0, 0.3)",
        }}
      >
        {isGoogleConnecting ? "[CONNECTING...]" : googleAuth ? "[GOOGLE: ON]" : "[GOOGLE: OFF]"}
      </button>

      {/* Building Rooms */}
      {buildingRooms.length > 0 && (
        <div className="mt-2 border border-[#f59e0b]/40 bg-[#0a0a0a]/90 p-2 max-w-[200px]">
          <div className="text-[#f59e0b] text-[8px] font-mono mb-2 tracking-wider flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-[#f59e0b] rounded-full animate-pulse" />
            BUILDING
          </div>
          {buildingRooms.map((room) => (
            <div key={room.id} className="mb-2 last:mb-0">
              <div className="flex items-center justify-between gap-1">
                <div className="text-[#f59e0b]/90 text-[9px] font-mono truncate flex-1" title={room.prompt}>
                  {room.prompt.slice(0, 20)}{room.prompt.length > 20 ? "..." : ""}
                </div>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("cancel-build", { detail: { id: room.id } }))}
                  className="text-[#f59e0b]/40 hover:text-[#f59e0b] text-[10px] px-1 hover:bg-[#f59e0b]/10 rounded transition-colors"
                  title="Cancel build"
                >
                  x
                </button>
              </div>
              <div className="text-[#f59e0b]/60 text-[8px] font-mono animate-pulse">
                {room.status}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Created Rooms */}
      {createdRooms.length > 0 && (
        <div className="mt-2 border border-[#ff00ff]/40 bg-[#0a0a0a]/90 p-2 max-w-[200px]">
          <div className="text-[#ff00ff] text-[8px] font-mono mb-2 tracking-wider">
            YOUR ROOMS
          </div>
          {createdRooms.map((room, i) => (
            <div key={room.url + i} className="flex items-center gap-1 mb-1 last:mb-0">
              <a
                href={room.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-left text-[#ff00ff]/70 text-[9px] font-mono truncate hover:text-[#ff00ff] transition-colors"
                style={{ textShadow: "0 0 5px rgba(255, 0, 255, 0.3)" }}
                title={room.title}
              >
                {room.title}
              </a>
              <button
                onClick={() => onRemoveCreatedRoom(room.url)}
                className="text-[#ff00ff]/40 hover:text-[#ff00ff] text-[8px] px-1"
                title="Remove"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
