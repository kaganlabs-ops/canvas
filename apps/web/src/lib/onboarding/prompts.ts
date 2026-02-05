/**
 * Prompt templates for personality extraction
 */

export const PERSONALITY_EXTRACTION_PROMPT = `Analyze these WhatsApp messages and extract a personality profile.

Messages:
{messages}

Return a JSON object with this exact structure:

{
  "tone": {
    "overall": "e.g., casual, formal, energetic, calm, direct, warm",
    "formalityLevel": 1-5 (1=very casual, 5=very formal)
  },
  "writingStyle": {
    "capitalization": "e.g., all lowercase, normal capitalization, MIXED CAPS for emphasis",
    "avgMessageLength": "e.g., short bursts (5-15 words), medium (15-30 words), long (30+ words)",
    "sentenceStructure": "e.g., fragments, complete sentences, run-on sentences",
    "paragraphStyle": "e.g., one-liners, short paragraphs, long messages"
  },
  "punctuation": {
    "periodUsage": "always, sometimes, rarely, never",
    "exclamationMarks": "frequent, occasional, rare, never",
    "questionMarks": "frequent, occasional, rare",
    "ellipsisUsage": "frequent, occasional, rare, never",
    "emojiFrequency": "heavy, moderate, light, none",
    "topEmojis": ["emoji1", "emoji2", "emoji3"]
  },
  "vocabulary": {
    "signaturePhrases": ["phrase1", "phrase2", "phrase3", "phrase4", "phrase5"],
    "fillerWords": ["word1", "word2", "word3"],
    "slangLevel": "heavy, moderate, light, none",
    "jargonLevel": "heavy, moderate, light, none - and what domains",
    "languages": ["primary language", "secondary if code-switching"]
  },
  "communication": {
    "responseStyle": "e.g., direct answers, asks questions back, uses stories/examples",
    "agreementStyle": "how they say yes/agree",
    "disagreementStyle": "how they push back or disagree",
    "adviceStyle": "how they give advice - direct commands, suggestions, questions to ponder",
    "humorStyle": "e.g., sarcastic, self-deprecating, dry, playful, dad jokes, none"
  },
  "exampleMessages": [
    "5-7 representative messages that capture their voice perfectly"
  ]
}

Important:
- Base everything on actual patterns you observe in the messages
- For signaturePhrases, only include phrases that appear multiple times
- For topEmojis, only include emojis they actually use
- For exampleMessages, pick messages that best represent their unique voice
- Be specific and concrete, not generic

Return ONLY the JSON object, no additional text.`;

export function buildExtractionPrompt(messages: string[]): string {
  // Limit to avoid token limits - take a sample if too many
  const MAX_MESSAGES = 500;
  const messageSample =
    messages.length > MAX_MESSAGES
      ? sampleMessages(messages, MAX_MESSAGES)
      : messages;

  const messagesText = messageSample.map((m, i) => `${i + 1}. ${m}`).join("\n");

  return PERSONALITY_EXTRACTION_PROMPT.replace("{messages}", messagesText);
}

/**
 * Sample messages evenly from the full set to get a representative sample
 */
function sampleMessages(messages: string[], count: number): string[] {
  if (messages.length <= count) return messages;

  const sampled: string[] = [];
  const step = messages.length / count;

  for (let i = 0; i < count; i++) {
    const index = Math.floor(i * step);
    sampled.push(messages[index]);
  }

  return sampled;
}
