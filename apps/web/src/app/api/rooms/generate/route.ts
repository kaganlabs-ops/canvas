import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { promises as fs } from "fs";
import path from "path";

const anthropic = new Anthropic();

interface Character {
  id: string;
  name: string;
  topics: string[];
}

interface RoomConfig {
  type: string;
  characterIds: string[];
  title?: string;
}

const CHARACTERS_FILE = path.join(process.cwd(), "data", "characters.json");

async function getAllCharacters(): Promise<Character[]> {
  try {
    const data = await fs.readFile(CHARACTERS_FILE, "utf-8");
    const parsed = JSON.parse(data);
    return parsed.characters || [];
  } catch {
    return [];
  }
}

const SYSTEM_PROMPT = `You are NUTZ, an AI that generates room configurations based on user prompts.

Your job is to interpret what the user wants and generate a room configuration.

## Available Room Types
- "learn" - A room where users learn from AI characters through conversation

## Your Task
Given a user's prompt, determine:
1. What type of room they want (currently only "learn" is available)
2. Which characters should be in the room (from the available list)
3. A title for the room (optional, short and descriptive)

## Response Format
You must call the create_room_config tool with your generated configuration.

## Guidelines
- If the user mentions a specific person/character, include them if available
- If they mention a topic, find characters who teach that topic
- If vague, include 1-2 relevant characters
- Keep it focused - don't add all characters unless requested
- Default to "learn" room type`;

const tools: Anthropic.Tool[] = [
  {
    name: "create_room_config",
    description: "Generate a room configuration based on the user's prompt",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          description: "Room type: 'learn'",
          enum: ["learn"],
        },
        characterIds: {
          type: "array",
          items: { type: "string" },
          description: "Array of character IDs to include in the room",
        },
        title: {
          type: "string",
          description: "Optional short title for the room",
        },
        reasoning: {
          type: "string",
          description: "Brief explanation of why you chose this configuration",
        },
      },
      required: ["type", "characterIds"],
    },
  },
];

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Get available characters
    const characters = await getAllCharacters();

    if (characters.length === 0) {
      return NextResponse.json(
        { error: "No characters available" },
        { status: 500 }
      );
    }

    // Build character list for the prompt
    const characterList = characters
      .map((c) => `- ${c.id}: "${c.name}" (teaches: ${c.topics.join(", ")})`)
      .join("\n");

    const contextPrompt = `## Available Characters\n${characterList}\n\n## User's Request\n"${prompt}"`;

    // Call Claude to interpret the prompt
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      tool_choice: { type: "tool", name: "create_room_config" },
      messages: [{ role: "user", content: contextPrompt }],
    });

    // Extract the tool call
    const toolUse = response.content.find((block) => block.type === "tool_use");

    if (!toolUse || toolUse.type !== "tool_use") {
      // Fallback: create a learn room with all characters
      return NextResponse.json({
        config: {
          type: "learn",
          characterIds: characters.map((c) => c.id),
        },
        reasoning: "Fallback configuration",
      });
    }

    const input = toolUse.input as RoomConfig & { reasoning?: string };

    // Validate character IDs exist
    const validCharacterIds = input.characterIds.filter((id) =>
      characters.some((c) => c.id === id)
    );

    if (validCharacterIds.length === 0) {
      // If no valid characters, use all of them
      validCharacterIds.push(...characters.map((c) => c.id));
    }

    return NextResponse.json({
      config: {
        type: input.type || "learn",
        characterIds: validCharacterIds,
        title: input.title,
      },
      reasoning: input.reasoning,
    });
  } catch (error) {
    console.error("Room generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate room configuration" },
      { status: 500 }
    );
  }
}
