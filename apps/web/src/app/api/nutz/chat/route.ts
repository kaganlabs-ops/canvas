import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs/promises";
import path from "path";

const anthropic = new Anthropic();

interface Message {
  role: "user" | "assistant";
  content: string;
}

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

const ROOMS_DIR = path.join(process.cwd(), "rooms");

const SYSTEM_PROMPT = `You are NUTZ, an intelligent learning companion that creates real-time visual aids as users learn. You enhance the learning experience by generating dynamic presentations, key points, and visual summaries that complement what the character is teaching.

You have FULL CONTROL over the room's visual layer. Your job is to CREATE ENGAGING, EDUCATIONAL VISUALS in real-time.

## YOUR PRIMARY MISSION
When users are learning from a character:
1. Check the CHARACTER'S KNOWLEDGE BASE first - this tells you what they can teach
2. Listen to the conversation transcript for context
3. Create visual aids that ENHANCE the learning using the knowledge base content
4. ALWAYS use split-screen on the RIGHT side (layout: "right") so the character stays visible on the left
5. Keep content clean, well-spaced, and easy to read

## CRITICAL LAYOUT RULE
**ALWAYS use layout: "right" for split-screen** - The character video is on the left side of the screen. Your content panel should be on the RIGHT so it doesn't cover the character.

## LEARNING-FOCUSED COMPONENTS

### Split-Screen Layout (ALWAYS use layout: "right"!)
- "split-screen" - Side panel (props: layout: "right", width: "35%"|"40%"|"45%")
  ALWAYS put content on the RIGHT so the character stays visible!

### Key Learning Components (use inside split-screen)
- "lesson-card" - Numbered lesson point (props: title, content, number?, icon?)
- "key-point" - Highlighted insight (props: text, emphasis: "normal"|"important"|"critical", icon?)
- "definition" - Term + definition + example (props: term, definition, example?)
- "example-box" - Examples/code/formulas (props: content, type: "example"|"code"|"formula"|"analogy", title?)
- "summary-panel" - Lesson summary (props: points[], conclusion?, title?)

### Visual Components
- "concept-diagram" - Visual concept map (props: center, items[], title?)
- "heading" - Heading (props: text, level 1-4, color)
- "quote" - Quote (props: text, author?)

### Interactive Learning
- "flashcard" - Q&A card (props: front, back, showBack?)
- "quiz-question" - Multiple choice (props: question, options[], correctIndex?, showAnswer?)

### Fun
- "floating-emoji" - Celebration (props: emoji, count)

## ANIMATIONS
- "fade-in" - Gentle fade
- "slide-up" - Slide from bottom
- "slide-left" - Slide from right (good for right panels)

## HOW TO CREATE PRESENTATIONS

1. FIRST: Call clear_all_components to start fresh
2. Create split-screen with layout: "right", width: "40%"
3. Add 3-5 lesson-cards or key-points based on the CHARACTER'S KNOWLEDGE BASE
4. Keep text SHORT - max 2 sentences per card
5. Use animations: "slide-up" for sequential appearance

## EXAMPLE: Creating a Presentation

For Steve Jobs teaching Product Design:
1. clear_all_components
2. add_component: split-screen (layout: "right", width: "40%")
3. add_component: heading (text: "Product Design Principles")
4. add_component: lesson-card (number: 1, title: "Simplicity", content: "Remove everything that isn't essential. The best designs are invisible.")
5. add_component: lesson-card (number: 2, title: "Customer First", content: "Start with the customer experience. Work backwards to the technology.")
6. add_component: key-point (text: "Say no to 1000 things - focus means sacrifice", emphasis: "important")

## RULES
1. ALWAYS use layout: "right" for split-screen - NEVER "left"
2. Use the CHARACTER'S KNOWLEDGE BASE to create accurate content
3. Keep text SHORT - this is visual learning, not reading
4. Create 3-5 components max per presentation
5. Clear existing components before creating new presentations

Keep responses SHORT - just confirm what you created.`;

const tools: Anthropic.Tool[] = [
  {
    name: "add_component",
    description: "Add a new component to the room. IMPORTANT: For split-screen, ALWAYS use layout: 'right' so character stays visible on left side. Use learning components: split-screen, lesson-card, key-point, definition, summary-panel.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          description: "Component type. LEARNING COMPONENTS: split-screen (ALWAYS layout:'right'), lesson-card, key-point, definition, example-box, summary-panel, heading, quote, flashcard, quiz-question, floating-emoji",
        },
        props: {
          type: "object",
          description: "Component properties (varies by type). Examples: {text: 'Hello'}, {title: 'My Card', content: '...'}, {items: ['one', 'two']}, {emoji: '🎉', count: 5}",
        },
        position: {
          type: "object",
          description: "Position on screen. Use anchor ('top-left', 'center', 'bottom-right', etc.) or x/y coordinates ('50%', '100px')",
          properties: {
            anchor: { type: "string" },
            x: { type: "string" },
            y: { type: "string" },
          },
        },
        animation: {
          type: "string",
          description: "Animation: fade-in, slide-up, slide-down, pulse, bounce",
        },
      },
      required: ["type", "props"],
    },
  },
  {
    name: "update_component",
    description: "Update an existing component's properties",
    input_schema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description: "The component ID to update",
        },
        props: {
          type: "object",
          description: "New properties to merge with existing",
        },
        position: {
          type: "object",
          description: "New position",
        },
        animation: {
          type: "string",
          description: "New animation",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "remove_component",
    description: "Remove a component from the room",
    input_schema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description: "The component ID to remove",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "clear_all_components",
    description: "Remove ALL components from the room - use this to start fresh or reset",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_current_components",
    description: "Get a list of all current components in the room (useful before making updates)",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
];

async function getCustomizations(roomId: string): Promise<Customizations> {
  const customizationsPath = path.join(ROOMS_DIR, roomId, "customizations.json");
  try {
    const content = await fs.readFile(customizationsPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return { components: [] };
  }
}

async function saveCustomizations(roomId: string, customizations: Customizations): Promise<void> {
  const roomDir = path.join(ROOMS_DIR, roomId);
  const customizationsPath = path.join(roomDir, "customizations.json");
  await fs.mkdir(roomDir, { recursive: true });
  await fs.writeFile(customizationsPath, JSON.stringify(customizations, null, 2));
}

function generateId(): string {
  return `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

interface RoomContext {
  roomId: string;
  roomType: string;
  character: {
    name: string;
    topics: string[];
    knowledge?: string;
  } | null;
  isInCall: boolean;
  conversationTranscript: Array<{
    speaker: string;
    text: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, message, history, roomContext } = body as {
      roomId: string;
      message: string;
      history: Message[];
      roomContext?: RoomContext;
    };

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Convert history to Anthropic format
    const messages: Anthropic.MessageParam[] = [
      ...history.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user" as const, content: message },
    ];

    let edited = false;
    let responseText = "";

    // Build dynamic context for the system prompt
    let contextSection = `\n\n## Current Room Context\n- Room ID: ${roomId}`;

    if (roomContext) {
      contextSection += `\n- Room Type: ${roomContext.roomType}`;

      if (roomContext.character) {
        contextSection += `\n- Active Character: ${roomContext.character.name}`;
        if (roomContext.character.topics.length > 0) {
          contextSection += `\n- Character Topics: ${roomContext.character.topics.join(", ")}`;
        }

        // Include character's knowledge base - this is what the character can teach
        if (roomContext.character.knowledge) {
          contextSection += `\n\n## CHARACTER'S KNOWLEDGE BASE (Use this to create accurate visual content!)\n${roomContext.character.knowledge}`;
        }
      }

      contextSection += `\n- User is ${roomContext.isInCall ? "currently in a call" : "not in a call"}`;

      if (roomContext.conversationTranscript.length > 0) {
        contextSection += `\n\n## Full Conversation Transcript (${roomContext.conversationTranscript.length} messages)\n`;
        contextSection += roomContext.conversationTranscript
          .map((t, i) => `[${i + 1}] ${t.speaker}: "${t.text}"`)
          .join("\n");
      }
    }

    // Initial API call
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT + contextSection,
      tools,
      messages,
    });

    // Process tool calls in a loop
    while (response.stop_reason === "tool_use") {
      // Handle ALL tool use blocks in this response
      const toolUseBlocks = response.content.filter((block) => block.type === "tool_use");

      if (toolUseBlocks.length === 0) break;

      const toolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = [];

      for (const toolUseBlock of toolUseBlocks) {
        if (toolUseBlock.type !== "tool_use") continue;

        const toolName = toolUseBlock.name;
        const toolInput = toolUseBlock.input as Record<string, unknown>;
        let toolResult = "";

        if (toolName === "add_component") {
          const customizations = await getCustomizations(roomId);
          const newComponent: RoomComponent = {
            id: generateId(),
            type: toolInput.type as string,
            props: toolInput.props as Record<string, unknown>,
            position: toolInput.position as RoomComponent["position"],
            animation: toolInput.animation as string | undefined,
          };
          customizations.components.push(newComponent);
          await saveCustomizations(roomId, customizations);
          edited = true;
          toolResult = `Added ${toolInput.type} component with id: ${newComponent.id}`;
        } else if (toolName === "update_component") {
          const customizations = await getCustomizations(roomId);
          const index = customizations.components.findIndex((c) => c.id === toolInput.id);
          if (index !== -1) {
            if (toolInput.props) {
              customizations.components[index].props = {
                ...customizations.components[index].props,
                ...(toolInput.props as Record<string, unknown>),
              };
            }
            if (toolInput.position) {
              customizations.components[index].position = toolInput.position as RoomComponent["position"];
            }
            if (toolInput.animation) {
              customizations.components[index].animation = toolInput.animation as string;
            }
            await saveCustomizations(roomId, customizations);
            edited = true;
            toolResult = `Updated component ${toolInput.id}`;
          } else {
            toolResult = `Component ${toolInput.id} not found`;
          }
        } else if (toolName === "remove_component") {
          const customizations = await getCustomizations(roomId);
          const index = customizations.components.findIndex((c) => c.id === toolInput.id);
          if (index !== -1) {
            customizations.components.splice(index, 1);
            await saveCustomizations(roomId, customizations);
            edited = true;
            toolResult = `Removed component ${toolInput.id}`;
          } else {
            toolResult = `Component ${toolInput.id} not found`;
          }
        } else if (toolName === "clear_all_components") {
          const customizations = await getCustomizations(roomId);
          customizations.components = [];
          await saveCustomizations(roomId, customizations);
          edited = true;
          toolResult = "Cleared all components from the room";
        } else if (toolName === "get_current_components") {
          const customizations = await getCustomizations(roomId);
          if (customizations.components.length === 0) {
            toolResult = "No components in the room yet";
          } else {
            toolResult = JSON.stringify(
              customizations.components.map((c) => ({
                id: c.id,
                type: c.type,
                props: c.props,
              })),
              null,
              2
            );
          }
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUseBlock.id,
          content: toolResult,
        });
      }

      // Add assistant message with tool use and ALL tool results
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
        max_tokens: 4096,
        system: SYSTEM_PROMPT + contextSection,
        tools,
        messages,
      });
    }

    // Extract final text response
    const textContent = response.content.find((block) => block.type === "text");
    responseText = textContent?.type === "text" ? textContent.text : "Done!";

    return NextResponse.json({
      response: responseText,
      roomId,
      edited,
    });
  } catch (error) {
    console.error("NUTZ chat error:", error);
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}
