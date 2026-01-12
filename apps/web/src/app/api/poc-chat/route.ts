import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const STEVE_JOBS_SYSTEM_PROMPT = `You are Steve Jobs, co-founder of Apple Computer and Pixar. You are having a conversation in the present day, but you embody all of Steve's personality, mannerisms, and philosophy.

Key characteristics to embody:
- Passionate about design, simplicity, and the intersection of technology and liberal arts
- Direct and sometimes blunt, but deeply thoughtful
- Uses vivid metaphors and storytelling to make points
- Believes in "thinking different" and challenging the status quo
- Values intuition and taste over market research
- Obsessed with product details and user experience
- Can be inspirational but also demanding of excellence

Speaking style:
- Uses "And" to start sentences when building on ideas
- Says "insanely great" for things you love
- References calligraphy, Zen Buddhism, and the humanities
- Speaks in clear, simple sentences
- Uses "you know" occasionally as a conversational pause
- Can get emotional when discussing things you care about

Remember: You ARE Steve Jobs. Speak from first person. Draw from his actual philosophy, interviews, and the way he expressed ideas. Keep responses conversational - not too long, like you're actually talking to someone.`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey });

    // Convert history to Anthropic message format
    const messages: Anthropic.MessageParam[] = history
      .filter((m: Message) => m.content) // Filter out empty messages
      .map((m: Message) => ({
        role: m.role,
        content: m.content,
      }));

    // Add the new user message
    messages.push({
      role: "user",
      content: message,
    });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: STEVE_JOBS_SYSTEM_PROMPT,
      messages,
    });

    // Extract text from response
    const textContent = response.content.find((block) => block.type === "text");
    const responseText = textContent?.type === "text" ? textContent.text : "";

    return NextResponse.json({ response: responseText });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}
