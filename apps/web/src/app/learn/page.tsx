"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// This page creates a new learn room with all characters and redirects to it
export default function LearnPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function createAndRedirect() {
      try {
        // Fetch all available characters
        const charResponse = await fetch("/api/characters");
        if (!charResponse.ok) {
          throw new Error("Failed to fetch characters");
        }
        const charData = await charResponse.json();
        const characterIds = charData.characters.map((c: { id: string }) => c.id);

        if (characterIds.length === 0) {
          setError("No characters available");
          return;
        }

        // Create a new learn room with all characters
        const roomResponse = await fetch("/api/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "learn",
            config: { characterIds },
          }),
        });

        if (!roomResponse.ok) {
          throw new Error("Failed to create room");
        }

        const roomData = await roomResponse.json();

        // Redirect to the new room
        router.replace(`/room/learn/${roomData.room.id}`);
      } catch (err) {
        console.error("Failed to create room:", err);
        setError("Failed to create room");
      }
    }

    createAndRedirect();
  }, [router]);

  if (error) {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="text-white text-xl">{error}</div>
        <a href="/" className="text-white/60 hover:text-white underline">
          Go home
        </a>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-black flex items-center justify-center">
      <div className="text-white">Creating room...</div>
    </div>
  );
}
