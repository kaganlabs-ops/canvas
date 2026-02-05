export interface PersonalityProfile {
  tone: {
    overall: string;
    formalityLevel: number; // 1-5
  };
  writingStyle: {
    capitalization: string;
    avgMessageLength: string;
    sentenceStructure: string;
    paragraphStyle: string;
  };
  punctuation: {
    periodUsage: string;
    exclamationMarks: string;
    questionMarks: string;
    ellipsisUsage: string;
    emojiFrequency: string;
    topEmojis: string[];
  };
  vocabulary: {
    signaturePhrases: string[];
    fillerWords: string[];
    slangLevel: string;
    jargonLevel: string;
    languages: string[];
  };
  communication: {
    responseStyle: string;
    agreementStyle: string;
    disagreementStyle: string;
    adviceStyle: string;
    humorStyle: string;
  };
  exampleMessages: string[];
}

export interface PersonalityExtractionResult {
  success: boolean;
  profile?: PersonalityProfile;
  error?: string;
  messageCount?: number;
}

export interface PersonalityAPIResponse {
  success: boolean;
  preview?: {
    tone: string;
    messageLength: string;
    signaturePhrases: string[];
    emojiUsage: string;
  };
  personalityMd?: string;
  savedTo?: string;
  error?: string;
}
