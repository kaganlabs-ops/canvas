/**
 * Personality Generator
 *
 * Generates personality.md markdown file from extracted personality profile.
 */

import { PersonalityProfile } from "./types";

/**
 * Generate markdown personality file from profile
 */
export function generatePersonalityMarkdown(
  profile: PersonalityProfile,
  creatorName: string
): string {
  const lines: string[] = [];

  lines.push(`# Personality Profile: ${creatorName}`);
  lines.push("");

  // Voice & Tone
  lines.push("## Voice & Tone");
  lines.push("");
  lines.push(
    `${creatorName} communicates with a ${profile.tone.overall} tone. Formality level: ${profile.tone.formalityLevel}/5.`
  );
  lines.push("");

  // Writing Rules
  lines.push("## Writing Rules");
  lines.push("");
  lines.push(`- **Capitalization:** ${profile.writingStyle.capitalization}`);
  lines.push(`- **Message length:** ${profile.writingStyle.avgMessageLength}`);
  lines.push(
    `- **Sentence structure:** ${profile.writingStyle.sentenceStructure}`
  );
  lines.push(`- **Paragraph style:** ${profile.writingStyle.paragraphStyle}`);
  lines.push(`- **Periods:** ${profile.punctuation.periodUsage}`);
  lines.push(
    `- **Exclamation marks:** ${profile.punctuation.exclamationMarks}`
  );
  lines.push(`- **Question marks:** ${profile.punctuation.questionMarks}`);
  lines.push(`- **Ellipsis (...):** ${profile.punctuation.ellipsisUsage}`);
  lines.push("");

  // Signature Phrases
  lines.push("## Signature Phrases");
  lines.push("");
  for (const phrase of profile.vocabulary.signaturePhrases) {
    lines.push(`- "${phrase}"`);
  }
  lines.push("");

  // Filler Words
  if (profile.vocabulary.fillerWords.length > 0) {
    lines.push("## Filler Words");
    lines.push("");
    lines.push(profile.vocabulary.fillerWords.map((w) => `"${w}"`).join(", "));
    lines.push("");
  }

  // Communication Style
  lines.push("## Communication Style");
  lines.push("");
  lines.push(`- **Response style:** ${profile.communication.responseStyle}`);
  lines.push(`- **When agreeing:** ${profile.communication.agreementStyle}`);
  lines.push(
    `- **When disagreeing:** ${profile.communication.disagreementStyle}`
  );
  lines.push(`- **When advising:** ${profile.communication.adviceStyle}`);
  lines.push(`- **Humor:** ${profile.communication.humorStyle}`);
  lines.push("");

  // Emoji Usage
  lines.push("## Emoji Usage");
  lines.push("");
  lines.push(`**Frequency:** ${profile.punctuation.emojiFrequency}`);
  if (profile.punctuation.topEmojis.length > 0) {
    lines.push("");
    lines.push(
      `**Most used:** ${profile.punctuation.topEmojis.join(" ")}`
    );
  }
  lines.push("");

  // Language & Vocabulary
  lines.push("## Language & Vocabulary");
  lines.push("");
  lines.push(`- **Languages:** ${profile.vocabulary.languages.join(", ")}`);
  lines.push(`- **Slang level:** ${profile.vocabulary.slangLevel}`);
  lines.push(`- **Jargon level:** ${profile.vocabulary.jargonLevel}`);
  lines.push("");

  // Example Messages
  lines.push("## Example Messages (Reference)");
  lines.push("");
  lines.push("These are representative messages that capture the voice:");
  lines.push("");
  for (const example of profile.exampleMessages) {
    lines.push(`> ${example}`);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Generate a preview object for displaying to the creator
 */
export function generatePreview(profile: PersonalityProfile): {
  tone: string;
  messageLength: string;
  signaturePhrases: string[];
  emojiUsage: string;
} {
  return {
    tone: profile.tone.overall,
    messageLength: profile.writingStyle.avgMessageLength,
    signaturePhrases: profile.vocabulary.signaturePhrases.slice(0, 5),
    emojiUsage:
      profile.punctuation.emojiFrequency +
      (profile.punctuation.topEmojis.length > 0
        ? `, mostly ${profile.punctuation.topEmojis.slice(0, 3).join(" ")}`
        : ""),
  };
}
