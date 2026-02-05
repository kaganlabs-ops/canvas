/**
 * Personality Extractor
 *
 * Uses Claude to analyze WhatsApp messages and extract a structured personality profile.
 */

import Anthropic from "@anthropic-ai/sdk";
import { PersonalityProfile, PersonalityExtractionResult } from "./types";
import { buildExtractionPrompt } from "./prompts";

const anthropic = new Anthropic();

const MIN_MESSAGES_REQUIRED = 50;

/**
 * Extract personality profile from WhatsApp messages
 */
export async function extractPersonality(
  messages: string[],
  creatorName: string
): Promise<PersonalityExtractionResult> {
  // Validate we have enough messages
  if (messages.length < MIN_MESSAGES_REQUIRED) {
    return {
      success: false,
      error: `Not enough messages. Found ${messages.length}, need at least ${MIN_MESSAGES_REQUIRED} for reliable extraction.`,
      messageCount: messages.length,
    };
  }

  const prompt = buildExtractionPrompt(messages);

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Extract text content
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return {
        success: false,
        error: "No text response from Claude",
        messageCount: messages.length,
      };
    }

    // Parse the JSON response
    const jsonText = textBlock.text.trim();

    // Handle markdown code blocks
    let cleanJson = jsonText;
    if (jsonText.startsWith("```")) {
      const lines = jsonText.split("\n");
      // Remove first line (```json) and last line (```)
      cleanJson = lines.slice(1, -1).join("\n");
    }

    const profile = JSON.parse(cleanJson) as PersonalityProfile;

    return {
      success: true,
      profile,
      messageCount: messages.length,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Handle JSON parse errors specifically
    if (errorMessage.includes("JSON")) {
      return {
        success: false,
        error: `Failed to parse personality profile: ${errorMessage}`,
        messageCount: messages.length,
      };
    }

    return {
      success: false,
      error: `Extraction failed: ${errorMessage}`,
      messageCount: messages.length,
    };
  }
}
