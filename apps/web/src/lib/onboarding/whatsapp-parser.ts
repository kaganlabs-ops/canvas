/**
 * WhatsApp Export Parser
 *
 * Parses WhatsApp chat export .txt files and extracts messages from a specific sender.
 * Handles multiple WhatsApp export formats.
 */

// Common WhatsApp export formats:
// Format 1: [DD/MM/YYYY, HH:MM:SS] Name: Message
// Format 2: DD/MM/YYYY, HH:MM - Name: Message
// Format 3: [DD/MM/YY, HH:MM:SS] Name: Message
// Format 4: MM/DD/YY, HH:MM - Name: Message (US format)

const MESSAGE_PATTERNS = [
  // [DD/MM/YYYY, HH:MM:SS] Name: Message
  /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?\]\s*([^:]+):\s*(.+)$/i,
  // DD/MM/YYYY, HH:MM - Name: Message
  /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?\s*-\s*([^:]+):\s*(.+)$/i,
  // With unicode left-to-right mark that WhatsApp sometimes adds
  /^\u200e?\[?(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?\]?\s*-?\s*([^:]+):\s*(.+)$/i,
];

// System messages and media placeholders to filter out
const SKIP_PATTERNS = [
  /^<media omitted>$/i,
  /^<image omitted>$/i,
  /^<video omitted>$/i,
  /^<audio omitted>$/i,
  /^<sticker omitted>$/i,
  /^<document omitted>$/i,
  /^<gif omitted>$/i,
  /^<contact card omitted>$/i,
  /^image omitted$/i,
  /^video omitted$/i,
  /^audio omitted$/i,
  /messages and calls are end-to-end encrypted/i,
  /created group/i,
  /changed the subject/i,
  /changed this group's icon/i,
  /added you/i,
  /left$/i,
  /removed/i,
  /changed the group description/i,
  /turned on disappearing messages/i,
  /turned off disappearing messages/i,
  /changed the disappearing messages/i,
  /^\s*$/,
  /^null$/i,
  /^this message was deleted$/i,
  /^you deleted this message$/i,
  /^waiting for this message/i,
];

interface ParsedMessage {
  sender: string;
  content: string;
}

/**
 * Parse a single line and extract sender + message if it matches a message pattern
 */
function parseLine(line: string): ParsedMessage | null {
  // Clean the line
  const cleanLine = line.trim().replace(/\u200e/g, ""); // Remove left-to-right marks

  for (const pattern of MESSAGE_PATTERNS) {
    const match = cleanLine.match(pattern);
    if (match) {
      const sender = match[2].trim();
      const content = match[3].trim();
      return { sender, content };
    }
  }

  return null;
}

/**
 * Check if a message should be skipped (system message, media placeholder, etc.)
 */
function shouldSkipMessage(content: string): boolean {
  return SKIP_PATTERNS.some((pattern) => pattern.test(content.trim()));
}

/**
 * Normalize sender name for comparison (case-insensitive, trim whitespace)
 */
function normalizeName(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Parse WhatsApp export and extract messages from a specific sender
 *
 * @param content - Raw content of the WhatsApp export .txt file
 * @param senderName - Name of the sender to extract messages from
 * @returns Array of message strings from the specified sender
 */
export function parseWhatsAppExport(
  content: string,
  senderName: string
): string[] {
  const lines = content.split("\n");
  const messages: string[] = [];
  const normalizedSender = normalizeName(senderName);

  let currentMessage: ParsedMessage | null = null;

  for (const line of lines) {
    const parsed = parseLine(line);

    if (parsed) {
      // New message started
      // Save previous message if it was from our sender
      if (
        currentMessage &&
        normalizeName(currentMessage.sender) === normalizedSender
      ) {
        if (!shouldSkipMessage(currentMessage.content)) {
          messages.push(currentMessage.content);
        }
      }
      currentMessage = parsed;
    } else if (currentMessage && line.trim()) {
      // Continuation of previous message (multi-line message)
      currentMessage.content += "\n" + line.trim();
    }
  }

  // Don't forget the last message
  if (
    currentMessage &&
    normalizeName(currentMessage.sender) === normalizedSender
  ) {
    if (!shouldSkipMessage(currentMessage.content)) {
      messages.push(currentMessage.content);
    }
  }

  return messages;
}

/**
 * Get all unique sender names from a WhatsApp export
 * Useful for letting user select which sender they are
 */
export function getSendersFromExport(content: string): string[] {
  const lines = content.split("\n");
  const senders = new Set<string>();

  for (const line of lines) {
    const parsed = parseLine(line);
    if (parsed) {
      senders.add(parsed.sender);
    }
  }

  return Array.from(senders).sort();
}

/**
 * Get message count by sender
 * Useful for validating we have enough data
 */
export function getMessageCountsBySender(
  content: string
): Record<string, number> {
  const lines = content.split("\n");
  const counts: Record<string, number> = {};

  let currentSender: string | null = null;

  for (const line of lines) {
    const parsed = parseLine(line);
    if (parsed) {
      currentSender = parsed.sender;
      if (!shouldSkipMessage(parsed.content)) {
        counts[currentSender] = (counts[currentSender] || 0) + 1;
      }
    }
  }

  return counts;
}
