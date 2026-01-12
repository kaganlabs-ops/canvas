import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

interface Room {
  id: string;
  type: string;
  config: {
    characterIds: string[];
  };
  createdAt: string;
  parentRoomId?: string;
}

interface Character {
  id: string;
  name: string;
  avatar: string;
  topics: string[];
  agentId: string;
}

const ROOMS_FILE = path.join(process.cwd(), "data", "rooms.json");
const CHARACTERS_FILE = path.join(process.cwd(), "data", "characters.json");

// Default characters
const DEFAULT_CHARACTERS: Character[] = [
  {
    id: "steve-jobs",
    name: "Steve Jobs",
    avatar: "/steve-jobs-frame.jpg",
    topics: ["Product design", "Innovation", "Leadership"],
    agentId: "agent_1001kefsejbwfs38hagtrp87e3zw",
  },
  {
    id: "marc-andreessen",
    name: "Marc Andreessen",
    avatar: "/marc-avatar.jpg",
    topics: ["Software eating the world", "Tech investing", "Future of AI"],
    agentId: "agent_0801kegy1705fqwaj2azn67ndsh0",
  },
];

async function readRoomsFile(): Promise<{ rooms: Room[] }> {
  try {
    const data = await fs.readFile(ROOMS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return { rooms: [] };
  }
}

async function readCharactersFile(): Promise<{ characters: Character[] }> {
  try {
    const data = await fs.readFile(CHARACTERS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return { characters: [] };
  }
}

async function getAllCharacters(): Promise<Character[]> {
  const userData = await readCharactersFile();
  return [...DEFAULT_CHARACTERS, ...userData.characters];
}

// GET - List all rooms with their characters
export async function GET() {
  try {
    const roomsData = await readRoomsFile();
    const allCharacters = await getAllCharacters();

    // Map rooms to include character data
    const roomsWithCharacters = roomsData.rooms.map((room) => {
      const characterIds = room.config?.characterIds || [];
      const characters = allCharacters.filter((c) =>
        characterIds.includes(c.id)
      );
      return {
        room,
        characters,
      };
    });

    // Sort by most recent first
    roomsWithCharacters.sort(
      (a, b) =>
        new Date(b.room.createdAt).getTime() -
        new Date(a.room.createdAt).getTime()
    );

    return NextResponse.json({ rooms: roomsWithCharacters });
  } catch (error) {
    console.error("Error listing rooms:", error);
    return NextResponse.json(
      { error: "Failed to list rooms" },
      { status: 500 }
    );
  }
}
