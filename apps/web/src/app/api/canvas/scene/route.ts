import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SceneElement {
  id: string;
  type: "emoji" | "text" | "shape";
  content: string;
  position: { x: number; y: number };
  size: number;
  color: string;
  animation?: "float" | "pulse" | "spin" | "bounce" | "none";
  rotation?: number;
  opacity?: number;
  draggable?: boolean;
  clickable?: boolean;
  onClick?: string;
}

const SYSTEM_PROMPT = `You are a creative scene builder. The user is in an empty canvas and can ask you to add, remove, or modify visual elements.

Your job is to interpret what they want and use the tools to create it visually. Be creative and generous - if they say "add a forest", add multiple trees. If they say "make it night", add stars and a moon.

## Guidelines
- Be creative with positions - spread things out nicely
- Use appropriate sizes (10-80, where 40 is medium)
- For emojis, find the best matching emoji
- For text, keep it short and impactful
- For shapes, use colors that match the mood
- Add animations to make things feel alive
- When removing, be smart about what they mean
- Make elements draggable when the user wants to move things around
- You can make elements clickable with custom actions

## Positions
- x and y are percentages (0-100)
- Leave space at the bottom (y < 70) for the chat
- Spread elements nicely across the canvas

## Animations
- "float" - gentle up/down movement (good for clouds, ghosts)
- "pulse" - size pulsing (good for hearts, stars)
- "spin" - rotation (good for planets, wheels)
- "bounce" - bouncing (good for balls, characters)
- "none" - static

## Interactivity
- draggable: true - user can drag the element around
- When user says "make it draggable" or "let me move it", set draggable to true
- By default, make new elements draggable so users can arrange them

## Click Actions
You can make elements clickable with various actions:
- "showImage" - displays an image (payload = image URL or emoji description)
- "showText" - shows a popup message (payload = the text)
- "playSound" - plays a sound effect (payload = sound name like "pop", "magic", "whoosh")
- "navigate" - goes to a URL (payload = the URL)
- "addElements" - adds more elements when clicked (payload = JSON array of elements to add)
- "removeThis" - removes the clicked element (no payload needed)
- "transform" - changes the element itself (payload = JSON of property changes)

Examples:
- Mushroom that shows trippy visuals: clickAction: { type: "showImage", payload: "psychedelic swirl" }
- Button that adds confetti: clickAction: { type: "addElements", payload: "[{type:'emoji',content:'🎊'}]" }
- Element that disappears: clickAction: { type: "removeThis" }

Keep responses SHORT (1 sentence). Focus on the visual creation.`;

const tools: Anthropic.Tool[] = [
  {
    name: "add_element",
    description: "Add a visual element to the scene. Use this to create emojis, text, or shapes.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["emoji", "text", "shape"],
          description: "Type of element. emoji for any visual object, text for words, shape for geometric forms",
        },
        content: {
          type: "string",
          description: "For emoji: the emoji character(s). For text: the words. For shape: 'circle', 'square', 'triangle'",
        },
        x: {
          type: "number",
          description: "Horizontal position (0-100, where 50 is center)",
        },
        y: {
          type: "number",
          description: "Vertical position (0-100, where 0 is top). Keep under 65 to avoid chat area",
        },
        size: {
          type: "number",
          description: "Size (10-100, where 40 is medium)",
        },
        color: {
          type: "string",
          description: "Color as hex (e.g., '#ff0000') - mainly for text and shapes",
        },
        animation: {
          type: "string",
          enum: ["float", "pulse", "spin", "bounce", "none"],
          description: "Animation to apply",
        },
        draggable: {
          type: "boolean",
          description: "If true, user can drag this element around. Default to true for most elements.",
        },
        clickAction: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["showImage", "showText", "playSound", "navigate", "addElements", "removeThis", "transform"],
              description: "What happens when clicked",
            },
            payload: {
              type: "string",
              description: "Action data: URL for showImage/navigate, text for showText, or JSON for addElements/transform",
            },
          },
          description: "Make element clickable with an action",
        },
      },
      required: ["type", "content", "x", "y", "size"],
    },
  },
  {
    name: "remove_elements",
    description: "Remove elements from the scene",
    input_schema: {
      type: "object" as const,
      properties: {
        target: {
          type: "string",
          enum: ["all", "last", "matching"],
          description: "What to remove: 'all' clears everything, 'last' removes most recent, 'matching' removes by content",
        },
        match: {
          type: "string",
          description: "If target is 'matching', what content to match (e.g., emoji or text)",
        },
      },
      required: ["target"],
    },
  },
  {
    name: "modify_elements",
    description: "Modify existing elements - can change ANY property: position, size, color, animation, draggable, rotation, opacity, even the content itself",
    input_schema: {
      type: "object" as const,
      properties: {
        target: {
          type: "string",
          enum: ["all", "last", "matching"],
          description: "Which elements to modify",
        },
        match: {
          type: "string",
          description: "If target is 'matching', what content to match",
        },
        changes: {
          type: "object",
          properties: {
            content: { type: "string", description: "Change the emoji/text/shape content" },
            x: { type: "number", description: "New x position (0-100)" },
            y: { type: "number", description: "New y position (0-100)" },
            size: { type: "number", description: "New size" },
            color: { type: "string", description: "New color (hex)" },
            animation: { type: "string", description: "New animation" },
            rotation: { type: "number", description: "Rotation in degrees" },
            opacity: { type: "number", description: "Opacity 0-1" },
            draggable: { type: "boolean", description: "Make draggable or not" },
          },
          description: "Any properties to change",
        },
      },
      required: ["target", "changes"],
    },
  },
  {
    name: "duplicate_element",
    description: "Duplicate/copy an existing element, optionally at a new position",
    input_schema: {
      type: "object" as const,
      properties: {
        target: {
          type: "string",
          enum: ["last", "matching"],
          description: "Which element to duplicate",
        },
        match: {
          type: "string",
          description: "If target is 'matching', what content to match",
        },
        count: {
          type: "number",
          description: "How many copies to make (default 1)",
        },
        scatter: {
          type: "boolean",
          description: "If true, scatter the copies randomly. If false, stack them.",
        },
      },
      required: ["target"],
    },
  },
  {
    name: "finish_onboarding",
    description: "Call this when the user wants to save their creation and move on",
    input_schema: {
      type: "object" as const,
      properties: {
        roomName: {
          type: "string",
          description: "A short name for this room based on what was created",
        },
      },
      required: ["roomName"],
    },
  },
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history, currentElements } = body as {
      message: string;
      history: Message[];
      currentElements: SceneElement[];
    };

    // Build context about current scene
    let sceneContext = "\n\n## Current Scene\n";
    if (currentElements.length === 0) {
      sceneContext += "Empty canvas - nothing added yet.";
    } else {
      sceneContext += `${currentElements.length} elements:\n`;
      currentElements.forEach((el) => {
        sceneContext += `- ${el.type}: "${el.content}" at (${el.position.x}%, ${el.position.y}%) size ${el.size}${el.draggable ? " [draggable]" : ""}\n`;
      });
    }

    // Convert history
    const messages: Anthropic.MessageParam[] = [
      ...history.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user" as const, content: message },
    ];

    let responseText = "";
    const actions: Array<{
      type: "add" | "remove" | "modify" | "duplicate" | "finish";
      data: Record<string, unknown>;
    }> = [];

    // Call Claude
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: SYSTEM_PROMPT + sceneContext,
      tools,
      messages,
    });

    // Process tool calls
    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter((block) => block.type === "tool_use");
      if (toolUseBlocks.length === 0) break;

      const toolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = [];

      for (const toolUse of toolUseBlocks) {
        if (toolUse.type !== "tool_use") continue;

        const input = toolUse.input as Record<string, unknown>;

        if (toolUse.name === "add_element") {
          actions.push({
            type: "add",
            data: {
              id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              type: input.type,
              content: input.content,
              position: { x: input.x, y: input.y },
              size: input.size || 40,
              color: input.color || "#33ff00",
              animation: input.animation || "none",
              draggable: input.draggable !== false, // default to true
              rotation: input.rotation || 0,
              opacity: input.opacity ?? 1,
              clickAction: input.clickAction || null,
            },
          });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `Added ${input.type}: ${input.content}`,
          });
        } else if (toolUse.name === "duplicate_element") {
          actions.push({
            type: "duplicate",
            data: {
              target: input.target,
              match: input.match,
              count: input.count || 1,
              scatter: input.scatter !== false,
            },
          });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `Duplicated element`,
          });
        } else if (toolUse.name === "remove_elements") {
          actions.push({
            type: "remove",
            data: {
              target: input.target,
              match: input.match,
            },
          });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `Removed elements (${input.target})`,
          });
        } else if (toolUse.name === "modify_elements") {
          actions.push({
            type: "modify",
            data: {
              target: input.target,
              match: input.match,
              changes: input.changes,
            },
          });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `Modified elements`,
          });
        } else if (toolUse.name === "finish_onboarding") {
          actions.push({
            type: "finish",
            data: {
              roomName: input.roomName,
            },
          });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `Finishing onboarding`,
          });
        }
      }

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });

      response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: SYSTEM_PROMPT + sceneContext,
        tools,
        messages,
      });
    }

    // Get text response
    const textBlock = response.content.find((b) => b.type === "text");
    responseText = textBlock?.type === "text" ? textBlock.text : "Done!";

    return NextResponse.json({
      response: responseText,
      actions,
    });
  } catch (error) {
    console.error("Onboarding scene error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
