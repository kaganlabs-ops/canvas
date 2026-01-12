import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { fal } from "@fal-ai/client";
import Anthropic from "@anthropic-ai/sdk";

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
  createdAt?: string;
  // Knowledge base - the actual content the character can teach
  knowledge?: string;
  // The system prompt used for the ElevenLabs agent
  systemPrompt?: string;
}

// Hardcoded default characters
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
    knowledge: `
## Steve Jobs' Core Philosophy

### 1. Product Design Principles
- **Simplicity is the ultimate sophistication**: Remove everything that isn't essential. The best designs are invisible.
- **Start with the customer experience**: Work backwards to the technology. Never start with what's possible - start with what's magical.
- **Details matter obsessively**: The back of the fence matters even if no one sees it. Quality is about caring.
- **Say no to 1000 things**: Focus means saying no to the hundred other good ideas.

### 2. Innovation Philosophy
- **Think Different**: The people who are crazy enough to think they can change the world are the ones who do.
- **Connect the dots**: Innovation comes from connecting diverse experiences. Calligraphy led to Mac fonts.
- **Stay hungry, stay foolish**: Never be satisfied. Keep pushing boundaries.
- **Real artists ship**: Ideas are nothing without execution. A brilliant idea that never ships is worthless.

### 3. Leadership Principles
- **A-players hire A-players**: Build teams of the best people. B-players hire C-players.
- **Reality distortion field**: Believe impossible things are possible and inspire others to achieve them.
- **Brutal honesty**: Tell people their work is shit when it is. They'll respect you for it.
- **Integration over modularity**: Own the whole widget. Control hardware, software, and services together.

### 4. Famous Quotes to Use
- "Design is not just what it looks like. Design is how it works."
- "People don't know what they want until you show it to them."
- "Quality is more important than quantity. One home run is much better than two doubles."
- "Innovation distinguishes between a leader and a follower."
- "Your time is limited. Don't waste it living someone else's life."
`,
    systemPrompt: `You are Steve Jobs, co-founder of Apple. Speak with passion, intensity, and conviction. You believe in the intersection of technology and liberal arts. You're obsessed with design, simplicity, and creating products that change the world.

Your teaching style:
- Use concrete examples from Apple's history (Mac, iPod, iPhone)
- Challenge assumptions aggressively
- Be direct and sometimes blunt
- Paint vivid pictures of how technology should feel
- Reference your core principles: simplicity, focus, saying no, integration

When asked about any topic, relate it back to your experience building Apple and Pixar. Share specific stories and lessons learned.`,
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
    knowledge: `
## Marc Andreessen's Core Philosophy

### 1. Software Eating the World
- Every industry is being transformed by software
- Traditional companies are being disrupted by software-native competitors
- The best software companies will dominate their industries
- Network effects create winner-take-all markets

### 2. Tech Investing Principles
- Invest in technical founders who deeply understand their domain
- Market size matters but founder quality matters more
- It's better to be too early than too late
- The best companies often look crazy at first

### 3. Future of AI
- AI will be the biggest technological shift since the internet
- Every application will become AI-first
- Human-AI collaboration will be the new normal
- The companies that embrace AI fastest will win
`,
    systemPrompt: `You are Marc Andreessen, co-founder of Netscape and a16z. You're brilliant, verbose, and have strong opinions about technology's future. You coined "Software is eating the world."

Your teaching style:
- Think in systems and frameworks
- Make bold predictions about the future
- Reference historical tech cycles
- Be optimistic about technology's potential
- Use your investing experience to illustrate points`,
  },
];

const DATA_FILE = path.join(process.cwd(), "data", "characters.json");

async function readCharactersFile(): Promise<{ characters: Character[] }> {
  try {
    const data = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return { characters: [] };
  }
}

async function writeCharactersFile(data: { characters: Character[] }) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// GET - List all characters (default + user-created)
export async function GET() {
  try {
    const userData = await readCharactersFile();
    const allCharacters = [...DEFAULT_CHARACTERS, ...userData.characters];
    return NextResponse.json({ characters: allCharacters });
  } catch (error) {
    console.error("Error reading characters:", error);
    return NextResponse.json(
      { error: "Failed to read characters" },
      { status: 500 }
    );
  }
}

// POST - Create a new character (full pipeline)
export async function POST(request: NextRequest) {
  try {
    // Check required environment variables
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const falKey = process.env.FAL_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey || !falKey) {
      return NextResponse.json(
        { error: "Missing required API keys (ELEVENLABS_API_KEY, FAL_KEY)" },
        { status: 500 }
      );
    }

    fal.config({ credentials: falKey });

    // Parse form data
    const formData = await request.formData();
    const name = formData.get("name") as string;
    const photo = formData.get("photo") as File;
    const audio = formData.get("audio") as File;
    const topicsStr = formData.get("topics") as string;
    const systemPrompt = formData.get("systemPrompt") as string | null;

    if (!name || !photo || !audio) {
      return NextResponse.json(
        { error: "name, photo, and audio are required" },
        { status: 400 }
      );
    }

    const topics = topicsStr ? topicsStr.split(",").map((t) => t.trim()) : [];
    const characterId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    console.log("Creating character:", { name, characterId, topics });

    // Step 1: Upload photo to FAL storage
    console.log("Step 1: Uploading photo...");
    const photoUrl = await fal.storage.upload(photo);
    console.log("Photo uploaded:", photoUrl);

    // Step 2: Upload audio to FAL storage
    console.log("Step 2: Uploading audio...");
    const audioUrl = await fal.storage.upload(audio);
    console.log("Audio uploaded:", audioUrl);

    // Step 3: Clone voice with ElevenLabs
    console.log("Step 3: Cloning voice...");
    const audioResponse = await fetch(audioUrl);
    const audioBlob = await audioResponse.blob();

    const voiceFormData = new FormData();
    voiceFormData.append("name", `${name} Voice`);
    voiceFormData.append("files", audioBlob, "voice-sample.mp3");
    voiceFormData.append("remove_background_noise", "true");

    const voiceResponse = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: voiceFormData,
    });

    if (!voiceResponse.ok) {
      const errorText = await voiceResponse.text();
      throw new Error(`Voice cloning failed: ${errorText}`);
    }

    const voiceData = await voiceResponse.json();
    const voiceId = voiceData.voice_id;
    console.log("Voice cloned:", voiceId);

    // Step 4: Generate system prompt with Claude (if not provided)
    let finalSystemPrompt = systemPrompt;
    if (!finalSystemPrompt && anthropicKey) {
      console.log("Step 4: Generating system prompt with Claude...");
      const anthropic = new Anthropic({ apiKey: anthropicKey });
      const promptResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: `Create a short system prompt (2-3 sentences) for an AI assistant that roleplays as "${name}". The topics they're expert in are: ${topics.join(", ") || "general knowledge"}. The prompt should define their personality and speaking style. Don't include any preamble, just the prompt itself.`,
          },
        ],
      });
      finalSystemPrompt =
        promptResponse.content[0].type === "text"
          ? promptResponse.content[0].text
          : `You are ${name}. Speak naturally and share your expertise on ${topics.join(", ")}.`;
      console.log("System prompt generated:", finalSystemPrompt);
    } else if (!finalSystemPrompt) {
      finalSystemPrompt = `You are ${name}. Speak naturally and share your expertise on ${topics.join(", ") || "various topics"}.`;
    }

    // Step 5: Create ElevenLabs agent
    console.log("Step 5: Creating ElevenLabs agent...");
    const agentConfig = {
      name: `${name} Agent`,
      conversation_config: {
        agent: {
          prompt: { prompt: finalSystemPrompt },
          first_message: `Hello! I'm ${name}. What would you like to talk about?`,
          language: "en",
        },
        tts: { voice_id: voiceId },
      },
    };

    const agentResponse = await fetch(
      "https://api.elevenlabs.io/v1/convai/agents/create",
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(agentConfig),
      }
    );

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text();
      throw new Error(`Agent creation failed: ${errorText}`);
    }

    const agentData = await agentResponse.json();
    const agentId = agentData.agent_id;
    console.log("Agent created:", agentId);

    // Step 6: Generate video from photo
    console.log("Step 6: Generating video...");
    const videoResult = await fal.subscribe(
      "fal-ai/minimax/video-01/image-to-video",
      {
        input: {
          prompt:
            "A person with a subtle, natural expression, nodding gently and looking attentive, as if listening to someone speak. Natural lighting, realistic movement.",
          image_url: photoUrl,
        },
        logs: true,
      }
    );

    const videoUrl = videoResult.data?.video?.url;
    if (!videoUrl) {
      throw new Error("Video generation failed - no URL returned");
    }
    console.log("Video generated:", videoUrl);

    // Step 7: Save character to JSON file
    console.log("Step 7: Saving character...");
    const newCharacter: Character = {
      id: characterId,
      name,
      avatar: photoUrl,
      background: videoUrl,
      videoSources: {
        idle: videoUrl,
        listening: videoUrl,
        speaking: videoUrl,
      },
      topics,
      agentId,
      voiceId,
      createdAt: new Date().toISOString(),
    };

    const userData = await readCharactersFile();
    userData.characters.push(newCharacter);
    await writeCharactersFile(userData);

    console.log("Character created successfully:", newCharacter.id);

    return NextResponse.json({
      character: newCharacter,
      status: "success",
    });
  } catch (error) {
    console.error("Character creation error:", error);
    return NextResponse.json(
      { error: "Failed to create character", details: String(error) },
      { status: 500 }
    );
  }
}
