import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      system: `You are a presentation slide generator. Given spoken text, extract the key points as concise bullet points.

Rules:
- Maximum 3 bullet points
- Each bullet should be 3-8 words
- Focus on actionable insights or key concepts
- Use simple, powerful language (like Steve Jobs would)
- If the text is just small talk or greetings, return empty array

Return ONLY a JSON array of strings, nothing else. Example: ["Focus creates clarity", "Design is how it works", "Stay hungry, stay foolish"]`,
      messages: [
        {
          role: "user",
          content: `Extract key bullet points from this spoken text:\n\n"${text}"`,
        },
      ],
    });

    // Extract the text content
    const content = response.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ bullets: [] });
    }

    // Parse the JSON array
    try {
      const bullets = JSON.parse(content.text);
      if (Array.isArray(bullets)) {
        return NextResponse.json({ bullets: bullets.slice(0, 3) });
      }
    } catch {
      // If parsing fails, return empty
      console.error("Failed to parse bullets:", content.text);
    }

    return NextResponse.json({ bullets: [] });
  } catch (error) {
    console.error("Slide generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate slides", bullets: [] },
      { status: 500 }
    );
  }
}
