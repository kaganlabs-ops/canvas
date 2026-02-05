/**
 * Creator Onboarding - Personality Extraction API
 *
 * POST /api/onboarding/personality
 *
 * Upload a WhatsApp export file and extract a personality profile.
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import {
  parseWhatsAppExport,
  getSendersFromExport,
  getMessageCountsBySender,
} from "@/lib/onboarding/whatsapp-parser";
import { extractPersonality } from "@/lib/onboarding/personality-extractor";
import {
  generatePersonalityMarkdown,
  generatePreview,
} from "@/lib/onboarding/personality-generator";
import { PersonalityAPIResponse } from "@/lib/onboarding/types";

const AGENTS_DIR = path.join(process.cwd(), "agents");

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<PersonalityAPIResponse>> {
  try {
    const formData = await request.formData();

    const file = formData.get("file") as File | null;
    const creatorName = formData.get("creatorName") as string | null;
    const senderName = formData.get("senderName") as string | null;

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file uploaded" },
        { status: 400 }
      );
    }

    if (!creatorName) {
      return NextResponse.json(
        { success: false, error: "Creator name is required" },
        { status: 400 }
      );
    }

    // Read file content
    const content = await file.text();

    // If sender name not provided, return list of senders for user to choose
    if (!senderName) {
      const senders = getSendersFromExport(content);
      const counts = getMessageCountsBySender(content);

      return NextResponse.json(
        {
          success: false,
          error: "Please select which sender you are",
          senders: senders.map((s) => ({
            name: s,
            messageCount: counts[s] || 0,
          })),
        } as PersonalityAPIResponse & {
          senders: { name: string; messageCount: number }[];
        },
        { status: 400 }
      );
    }

    // Parse WhatsApp export
    const messages = parseWhatsAppExport(content, senderName);

    if (messages.length === 0) {
      const senders = getSendersFromExport(content);
      return NextResponse.json(
        {
          success: false,
          error: `No messages found from "${senderName}". Available senders: ${senders.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Extract personality
    const result = await extractPersonality(messages, creatorName);

    if (!result.success || !result.profile) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to extract personality",
        },
        { status: 400 }
      );
    }

    // Generate markdown
    const personalityMd = generatePersonalityMarkdown(
      result.profile,
      creatorName
    );

    // Generate preview
    const preview = generatePreview(result.profile);

    // Create agent folder and save personality.md
    const slug = slugify(creatorName);
    const agentDir = path.join(AGENTS_DIR, slug);

    await fs.mkdir(agentDir, { recursive: true });

    const personalityPath = path.join(agentDir, "personality.md");
    await fs.writeFile(personalityPath, personalityMd);

    // Also save the raw profile JSON for later use
    const profilePath = path.join(agentDir, "personality.json");
    await fs.writeFile(profilePath, JSON.stringify(result.profile, null, 2));

    return NextResponse.json({
      success: true,
      preview,
      personalityMd,
      savedTo: `/agents/${slug}/personality.md`,
      messageCount: result.messageCount,
    } as PersonalityAPIResponse & { messageCount: number });
  } catch (error) {
    console.error("Personality extraction error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/onboarding/personality?slug=kagan
 *
 * Get existing personality profile for a creator
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<PersonalityAPIResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "Slug parameter is required" },
        { status: 400 }
      );
    }

    const agentDir = path.join(AGENTS_DIR, slug);
    const personalityPath = path.join(agentDir, "personality.md");

    try {
      const personalityMd = await fs.readFile(personalityPath, "utf-8");
      return NextResponse.json({
        success: true,
        personalityMd,
        savedTo: `/agents/${slug}/personality.md`,
      });
    } catch {
      return NextResponse.json(
        { success: false, error: `No personality found for "${slug}"` },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Error reading personality:", error);
    return NextResponse.json(
      { success: false, error: "Failed to read personality" },
      { status: 500 }
    );
  }
}
