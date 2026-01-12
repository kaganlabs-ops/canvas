import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const ROOMS_DIR = path.join(process.cwd(), "rooms");

interface RoomComponent {
  id: string;
  type: string;
  props: Record<string, unknown>;
  position?: {
    x?: string;
    y?: string;
    anchor?: string;
  };
  style?: Record<string, string | number>;
  animation?: string;
  children?: RoomComponent[];
}

interface Customizations {
  components: RoomComponent[];
}

const DEFAULT_CUSTOMIZATIONS: Customizations = {
  components: [],
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const roomId = searchParams.get("id");

  if (!roomId) {
    return NextResponse.json({ error: "Room ID required" }, { status: 400 });
  }

  try {
    const customizationsPath = path.join(ROOMS_DIR, roomId, "customizations.json");

    try {
      const content = await fs.readFile(customizationsPath, "utf-8");
      const customizations = JSON.parse(content);
      return NextResponse.json({ customizations });
    } catch {
      // Return defaults if file doesn't exist
      return NextResponse.json({ customizations: DEFAULT_CUSTOMIZATIONS });
    }
  } catch (error) {
    console.error("Error reading customizations:", error);
    return NextResponse.json({ error: "Failed to read customizations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, customizations } = body;

    if (!roomId) {
      return NextResponse.json({ error: "Room ID required" }, { status: 400 });
    }

    const roomDir = path.join(ROOMS_DIR, roomId);
    const customizationsPath = path.join(roomDir, "customizations.json");

    // Ensure room directory exists
    await fs.mkdir(roomDir, { recursive: true });

    // Write customizations
    await fs.writeFile(customizationsPath, JSON.stringify(customizations, null, 2));

    return NextResponse.json({ success: true, customizations });
  } catch (error) {
    console.error("Error writing customizations:", error);
    return NextResponse.json({ error: "Failed to write customizations" }, { status: 500 });
  }
}
