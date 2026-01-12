import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface UserContext {
  timeOfDay: string;
  city: string;
  country: string;
  season: string;
  weather: string;
  greeting: string;
}

interface RoomSuggestion {
  id: string;
  title: string;
  description: string;
  mood: "cozy" | "neon" | "zen" | "work" | "creative";
  icon: string;
  prompt: string;
}

const SYSTEM_PROMPT = `You are Cosmos, a friendly guide helping new users discover what they can create in NUTZ.

## Your Personality
- Warm but concise - no fluff
- Curious about what they're interested in
- Playful but not cheesy
- Use natural language, not corporate speak
- Keep responses SHORT (1-2 sentences max)

## Your Goal
Help users figure out what room to create. A "room" is an AI-powered space that can be:
- A chat with a famous person (Steve Jobs, Einstein, etc.)
- A creative workspace
- An immersive 3D experience
- A learning environment
- Anything they can imagine

## How to Guide
1. Start with context-aware greeting (use the time/weather naturally)
2. Offer 3 room suggestions based on the vibe
3. If they chat, understand what they want and suggest rooms
4. When they pick or describe something, call create_room

## Available Moods (affects the visual style)
- "cozy" - Warm oranges, relaxed vibe, good for reflection/journaling
- "neon" - Cyberpunk pinks/cyans, energetic, good for creative chaos
- "zen" - Sage greens, minimal, good for focus/meditation
- "work" - Focus blues, clean, good for productivity/deep work
- "creative" - Purples/reds, inspiring, good for ideation/brainstorming

## Important
- Never say "I'm an AI" or break character
- Don't explain what NUTZ is unless asked
- Just be helpful and guide them to their first room
- When they express interest in something, create it

## Context Format
You'll receive user context (time, location, weather) to personalize your greeting.`;

const tools: Anthropic.Tool[] = [
  {
    name: "suggest_rooms",
    description: "Suggest 3 room options to the user. Call this at the start or when they seem unsure.",
    input_schema: {
      type: "object" as const,
      properties: {
        suggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Short room title (3-5 words)" },
              description: { type: "string", description: "One-liner about the room" },
              mood: { type: "string", enum: ["cozy", "neon", "zen", "work", "creative"] },
              icon: { type: "string", description: "Single emoji representing the room" },
              prompt: { type: "string", description: "The prompt to create this room" },
            },
            required: ["title", "description", "mood", "icon", "prompt"],
          },
          minItems: 3,
          maxItems: 3,
        },
      },
      required: ["suggestions"],
    },
  },
  {
    name: "update_mood",
    description: "Update the background mood based on what user is interested in. Use this when the conversation shifts toward a specific vibe.",
    input_schema: {
      type: "object" as const,
      properties: {
        mood: {
          type: "string",
          enum: ["cozy", "neon", "zen", "work", "creative"],
          description: "The mood to set",
        },
      },
      required: ["mood"],
    },
  },
  {
    name: "create_room",
    description: "Create a room when the user has decided what they want. This completes the onboarding.",
    input_schema: {
      type: "object" as const,
      properties: {
        prompt: {
          type: "string",
          description: "The room prompt/description",
        },
        mood: {
          type: "string",
          enum: ["cozy", "neon", "zen", "work", "creative"],
          description: "The visual mood for the room",
        },
      },
      required: ["prompt", "mood"],
    },
  },
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history, userContext } = body as {
      message: string;
      history: Message[];
      userContext?: UserContext;
    };

    // Build context for system prompt
    let contextSection = "";
    if (userContext) {
      contextSection = `\n\n## User Context
- Time: ${userContext.timeOfDay}
- Location: ${userContext.city !== "Unknown" ? `${userContext.city}, ${userContext.country}` : "Unknown"}
- Season: ${userContext.season}
- Weather vibe: ${userContext.weather}
- Suggested greeting: ${userContext.greeting}`;
    }

    // Convert history to Anthropic format
    const messages: Anthropic.MessageParam[] = [
      ...history.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    ];

    // Add user message if provided
    if (message) {
      messages.push({ role: "user" as const, content: message });
    }

    // If no messages, this is the initial greeting
    if (messages.length === 0) {
      messages.push({
        role: "user" as const,
        content: "[User just opened the app - greet them and suggest rooms]",
      });
    }

    let responseText = "";
    let suggestions: RoomSuggestion[] = [];
    let newMood: string | null = null;
    let createRoom: { prompt: string; mood: string } | null = null;

    // Initial API call
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT + contextSection,
      tools,
      messages,
    });

    // Process tool calls in a loop
    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter((block) => block.type === "tool_use");

      if (toolUseBlocks.length === 0) break;

      const toolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = [];

      for (const toolUseBlock of toolUseBlocks) {
        if (toolUseBlock.type !== "tool_use") continue;

        const toolName = toolUseBlock.name;
        const toolInput = toolUseBlock.input as Record<string, unknown>;
        let toolResult = "";

        if (toolName === "suggest_rooms") {
          const rawSuggestions = toolInput.suggestions as Array<{
            title: string;
            description: string;
            mood: string;
            icon: string;
            prompt: string;
          }>;
          suggestions = rawSuggestions.map((s, i) => ({
            id: `suggestion-${i}`,
            title: s.title,
            description: s.description,
            mood: s.mood as RoomSuggestion["mood"],
            icon: s.icon,
            prompt: s.prompt,
          }));
          toolResult = "Suggestions displayed to user";
        } else if (toolName === "update_mood") {
          newMood = toolInput.mood as string;
          toolResult = `Mood updated to ${newMood}`;
        } else if (toolName === "create_room") {
          createRoom = {
            prompt: toolInput.prompt as string,
            mood: toolInput.mood as string,
          };
          toolResult = "Room creation initiated";
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUseBlock.id,
          content: toolResult,
        });
      }

      // Add assistant message with tool use and all tool results
      messages.push({
        role: "assistant",
        content: response.content,
      });
      messages.push({
        role: "user",
        content: toolResults,
      });

      // Continue the conversation
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: SYSTEM_PROMPT + contextSection,
        tools,
        messages,
      });
    }

    // Extract final text response
    const textContent = response.content.find((block) => block.type === "text");
    responseText = textContent?.type === "text" ? textContent.text : "";

    return NextResponse.json({
      response: responseText,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      newMood: newMood || undefined,
      createRoom: createRoom || undefined,
    });
  } catch (error) {
    console.error("Onboarding chat error:", error);
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}
