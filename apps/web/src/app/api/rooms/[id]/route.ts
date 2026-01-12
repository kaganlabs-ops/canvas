import { NextRequest, NextResponse } from "next/server";
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

const ROOMS_FILE = path.join(process.cwd(), "data", "rooms.json");
const ROOMS_DIR = path.join(process.cwd(), "rooms");

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

// DELETE - Delete a room by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Room ID is required" },
        { status: 400 }
      );
    }

    const roomsData = await readRoomsFile();
    const roomIndex = roomsData.rooms.findIndex((r) => r.id === id);

    if (roomIndex === -1) {
      return NextResponse.json(
        { error: "Room not found" },
        { status: 404 }
      );
    }

    // Remove room from array
    roomsData.rooms.splice(roomIndex, 1);
    await writeRoomsFile(roomsData);

    // Also delete room's customizations folder if it exists
    const roomDir = path.join(ROOMS_DIR, id);
    try {
      await fs.rm(roomDir, { recursive: true, force: true });
    } catch {
      // Ignore if folder doesn't exist
    }

    console.log("Room deleted:", id);

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error("Error deleting room:", error);
    return NextResponse.json(
      { error: "Failed to delete room" },
      { status: 500 }
    );
  }
}
