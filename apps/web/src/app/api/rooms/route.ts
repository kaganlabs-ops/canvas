import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Room interface - generic container for any room type
interface Room {
  id: string;
  type: "learn" | "debate" | "chat" | "generated" | "immersive"; // room template type
  config: LearnRoomConfig | GeneratedRoomConfig | ImmersiveRoomConfig | Record<string, unknown>; // type-specific config
  creatorId?: string;
  parentRoomId?: string;
  createdAt: string;
}

// Config for "immersive" room type (3D experiences)
interface ImmersiveRoomConfig {
  prompt?: string;
  previewUrl?: string;
  status?: "generating" | "ready" | "error";
}

// Config for "learn" room type
interface LearnRoomConfig {
  characterIds: string[]; // which characters are in this room
}

// Config for "generated" room type (Daytona sandbox)
interface GeneratedRoomConfig {
  sandboxId?: string;
  previewUrl?: string;
  prompt: string;
  status: "generating" | "ready" | "error";
  error?: string;
}

// Character interface
interface Character {
  id: string;
  name: string;
  avatar: string;
  background: string;
  videoSources: {
    idle: string;
    listening: string;
    speaking: string;
  };
  topics: string[];
  agentId: string;
  voiceId?: string;
}

const ROOMS_FILE = path.join(process.cwd(), "data", "rooms.json");
const CHARACTERS_FILE = path.join(process.cwd(), "data", "characters.json");

// Default characters
const DEFAULT_CHARACTERS: Character[] = [
  {
    id: "steve-jobs",
    name: "Steve Jobs",
    avatar: "/steve-jobs-frame.jpg",
    background: "/listening.mp4",
    videoSources: {
      idle: "/listening.mp4",
      listening: "/listening.mp4",
      speaking: "/speaking.mp4",
    },
    topics: ["Product design", "Innovation", "Leadership"],
    agentId: "agent_1001kefsejbwfs38hagtrp87e3zw",
  },
  {
    id: "marc-andreessen",
    name: "Marc Andreessen",
    avatar: "/marc-avatar.jpg",
    background: "/marc-listening.mp4",
    videoSources: {
      idle: "/marc-listening.mp4",
      listening: "/marc-listening.mp4",
      speaking: "/marc-listening.mp4",
    },
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

async function writeRoomsFile(data: { rooms: Room[] }) {
  await fs.writeFile(ROOMS_FILE, JSON.stringify(data, null, 2));
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

async function getCharactersByIds(characterIds: string[]): Promise<Character[]> {
  const allCharacters = await getAllCharacters();
  return allCharacters.filter((c) => characterIds.includes(c.id));
}

// GET - Fetch a single room by ID (with related data)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("id");

    if (!roomId) {
      return NextResponse.json(
        { error: "Room ID is required" },
        { status: 400 }
      );
    }

    const roomsData = await readRoomsFile();
    const room = roomsData.rooms.find((r) => r.id === roomId);

    if (!room) {
      return NextResponse.json(
        { error: "Room not found" },
        { status: 404 }
      );
    }

    // Get characters for learn room
    let characters: Character[] = [];
    if (room.type === "learn") {
      const config = room.config as LearnRoomConfig;
      characters = await getCharactersByIds(config.characterIds);
    }

    return NextResponse.json({
      room,
      characters,
    });
  } catch (error) {
    console.error("Error fetching room:", error);
    return NextResponse.json(
      { error: "Failed to fetch room" },
      { status: 500 }
    );
  }
}

// POST - Create a new room
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, config, creatorId, parentRoomId } = body;

    if (!type) {
      return NextResponse.json(
        { error: "type is required" },
        { status: 400 }
      );
    }

    // Validate config based on type
    if (type === "learn") {
      const learnConfig = config as LearnRoomConfig;
      if (!learnConfig?.characterIds || learnConfig.characterIds.length === 0) {
        return NextResponse.json(
          { error: "characterIds required for learn room" },
          { status: 400 }
        );
      }
      // Verify characters exist
      const characters = await getCharactersByIds(learnConfig.characterIds);
      if (characters.length !== learnConfig.characterIds.length) {
        return NextResponse.json(
          { error: "Some characters not found" },
          { status: 404 }
        );
      }
    } else if (type === "generated") {
      const genConfig = config as GeneratedRoomConfig;
      // For generating status, only prompt is required
      // sandboxId and previewUrl are optional (can be set later)
      if (!genConfig?.prompt) {
        return NextResponse.json(
          { error: "prompt required for generated room" },
          { status: 400 }
        );
      }
    }

    // Generate room ID
    const roomId = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const newRoom: Room = {
      id: roomId,
      type,
      config,
      creatorId: creatorId || undefined,
      parentRoomId: parentRoomId || undefined,
      createdAt: new Date().toISOString(),
    };

    // Save to file
    const roomsData = await readRoomsFile();
    roomsData.rooms.push(newRoom);
    await writeRoomsFile(roomsData);

    console.log("Room created:", newRoom.id);

    // Return room with characters
    let characters: Character[] = [];
    if (type === "learn") {
      const learnConfig = config as LearnRoomConfig;
      characters = await getCharactersByIds(learnConfig.characterIds);
    }

    return NextResponse.json({
      room: newRoom,
      characters,
    });
  } catch (error) {
    console.error("Error creating room:", error);
    return NextResponse.json(
      { error: "Failed to create room" },
      { status: 500 }
    );
  }
}

// PATCH - Update a room (used for updating generation status)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, config } = body;

    if (!roomId) {
      return NextResponse.json(
        { error: "roomId is required" },
        { status: 400 }
      );
    }

    const roomsData = await readRoomsFile();
    const roomIndex = roomsData.rooms.findIndex((r) => r.id === roomId);

    if (roomIndex === -1) {
      return NextResponse.json(
        { error: "Room not found" },
        { status: 404 }
      );
    }

    // Update the room config
    roomsData.rooms[roomIndex].config = {
      ...roomsData.rooms[roomIndex].config,
      ...config,
    };

    await writeRoomsFile(roomsData);

    console.log("Room updated:", roomId);

    return NextResponse.json({
      room: roomsData.rooms[roomIndex],
    });
  } catch (error) {
    console.error("Error updating room:", error);
    return NextResponse.json(
      { error: "Failed to update room" },
      { status: 500 }
    );
  }
}
