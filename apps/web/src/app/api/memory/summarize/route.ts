import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

// Types matching our memory structure
interface ConversationMessage {
  role: "user" | "agent";
  text: string;
}

interface ExistingMemory {
  userFacts?: Record<string, string>;
  commitments?: Array<{
    text: string;
    madeOn: string;
    status: "open" | "done" | "abandoned";
    timesReminded: number;
  }>;
  steveObservations?: {
    notes: string[];
    consolidated: string[];
    importantTopics: string[];
  };
  relationship?: {
    sessionsCount: number;
    firstMet: string;
    memorableMoments: string[];
  };
}

interface MemoryExtraction {
  // Conversation summary
  topic: string;
  emotionalState: string;
  steveAdvice?: string;

  // New facts learned
  newFacts: Record<string, string>;

  // Commitments
  newCommitments: string[];
  completedCommitments: string[];

  // Steve's observations (free-form, human)
  observations: string[];

  // Important topics for proactivity
  importantTopics: string[];

  // Memorable moment (if any)
  memorableMoment?: string;
}

const EXTRACTION_PROMPT = `You are analyzing a conversation between Steve Jobs and a user. Extract memory that Steve would want to remember for future conversations.

Think like Steve Jobs - a mentor who pays close attention and isn't afraid to call things out later.

Given the conversation transcript and existing memory, extract:

1. **topic**: Main topic discussed (brief, 2-5 words)
2. **emotionalState**: How the user seemed ("fired up", "tired", "anxious", "confident", "defensive", "excited", etc.)
3. **steveAdvice**: What Steve advised or pushed them on (if any)
4. **newFacts**: Any new facts about the user (name, project, role, team, launch date, cofounder name, etc.)
5. **newCommitments**: Things the user committed to doing
6. **completedCommitments**: Commitments from before that they mentioned completing
7. **observations**: What would Steve notice about this person that he might bring up later? Be specific and human. Examples:
   - "They deflect every time money comes up"
   - "Third time mentioning co-founder negatively"
   - "They say 'I should' a lot but never 'I will'"
   - "Way less energy today than usual"
   - "Finally took action on something instead of just talking"
8. **importantTopics**: Topics that clearly matter to this user (for proactive follow-up)
9. **memorableMoment**: If something significant happened this session worth remembering long-term

Return JSON only, no markdown. Empty arrays/objects for fields with nothing to add.`;

export async function POST(request: NextRequest) {
  try {
    const { transcript, existingMemory, characterName } = (await request.json()) as {
      transcript: ConversationMessage[];
      existingMemory: ExistingMemory;
      characterName?: string;
    };

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }

    if (!transcript || transcript.length === 0) {
      return NextResponse.json(
        { error: "No transcript provided" },
        { status: 400 }
      );
    }

    const client = new Anthropic({ apiKey });

    // Format transcript for analysis
    const formattedTranscript = transcript
      .map((m) => `${m.role === "agent" ? (characterName || "Steve") : "User"}: ${m.text}`)
      .join("\n");

    // Format existing memory for context
    const existingContext = existingMemory
      ? `
EXISTING MEMORY (for context):
- Known facts: ${JSON.stringify(existingMemory.userFacts || {})}
- Open commitments: ${JSON.stringify(
          (existingMemory.commitments || [])
            .filter((c) => c.status === "open")
            .map((c) => c.text)
        )}
- Previous observations: ${JSON.stringify(
          (existingMemory.steveObservations?.notes || []).slice(-5)
        )}
- Sessions so far: ${existingMemory.relationship?.sessionsCount || 0}
`
      : "";

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: EXTRACTION_PROMPT,
      messages: [
        {
          role: "user",
          content: `${existingContext}

CONVERSATION TRANSCRIPT:
${formattedTranscript}

Extract memory from this conversation. Return JSON only.`,
        },
      ],
    });

    // Extract text from response
    const textContent = response.content.find((block) => block.type === "text");
    const responseText = textContent?.type === "text" ? textContent.text : "{}";

    // Parse the JSON response
    let extraction: MemoryExtraction;
    try {
      extraction = JSON.parse(responseText);
    } catch {
      console.error("Failed to parse extraction:", responseText);
      return NextResponse.json(
        { error: "Failed to parse memory extraction" },
        { status: 500 }
      );
    }

    return NextResponse.json({ extraction });
  } catch (error) {
    console.error("Memory summarize error:", error);
    return NextResponse.json(
      { error: "Failed to summarize conversation" },
      { status: 500 }
    );
  }
}
