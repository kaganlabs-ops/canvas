// Persona Response Tool - Claude responding in character
import Anthropic from '@anthropic-ai/sdk'
import type { ToolResult } from './index.js'

interface PersonaRespondParams {
  personaName: string
  personaDescription: string
  userMessage: string
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
}

// Generate a response as a specific persona
export async function personaRespond(params: PersonaRespondParams): Promise<ToolResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { success: false, error: 'ANTHROPIC_API_KEY not set' }
  }

  try {
    const client = new Anthropic({ apiKey })

    // Build the system prompt for the persona
    const systemPrompt = `You are ${params.personaName}. ${params.personaDescription}

IMPORTANT GUIDELINES:
- Stay completely in character at all times
- Respond as ${params.personaName} would, using their known speech patterns, vocabulary, and perspectives
- Draw from their known beliefs, experiences, and way of thinking
- Keep responses conversational and natural, as if in a real conversation
- Avoid breaking character or acknowledging that you're an AI
- If asked about events after your time, gracefully acknowledge your perspective is from your era
- Be engaging, thoughtful, and authentic to the persona`

    // Build messages array
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

    // Add conversation history if provided
    if (params.conversationHistory) {
      messages.push(...params.conversationHistory)
    }

    // Add the current user message
    messages.push({ role: 'user', content: params.userMessage })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages
    })

    // Extract text from response
    const textContent = response.content.find((block: { type: string }) => block.type === 'text') as { type: 'text'; text: string } | undefined
    const responseText = textContent ? textContent.text : ''

    return {
      success: true,
      data: {
        response: responseText,
        personaName: params.personaName
      }
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

// Generate a persona description based on a name (for famous people)
export async function generatePersonaDescription(name: string): Promise<ToolResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { success: false, error: 'ANTHROPIC_API_KEY not set' }
  }

  try {
    const client = new Anthropic({ apiKey })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Write a brief persona description for ${name} that captures their personality, speaking style, beliefs, and notable characteristics. This will be used as a system prompt for an AI to role-play as them. Keep it to 2-3 sentences focusing on their most distinctive traits.`
        }
      ]
    })

    const textContent = response.content.find((block: { type: string }) => block.type === 'text') as { type: 'text'; text: string } | undefined
    const description = textContent ? textContent.text : ''

    return {
      success: true,
      data: {
        name,
        description
      }
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

// Tool definition for the orchestrator
export const personaRespondTool = {
  name: 'personaRespond',
  description: 'Generate a response as a specific persona/character. The AI will stay in character and respond authentically.',
  parameters: {
    type: 'object',
    properties: {
      personaName: {
        type: 'string',
        description: 'The name of the persona (e.g., "Steve Jobs", "Albert Einstein")'
      },
      personaDescription: {
        type: 'string',
        description: 'A description of the persona\'s personality, speaking style, and characteristics'
      },
      userMessage: {
        type: 'string',
        description: 'The user\'s message to respond to'
      },
      conversationHistory: {
        type: 'array',
        description: 'Previous messages in the conversation',
        items: {
          type: 'object',
          properties: {
            role: { type: 'string', enum: ['user', 'assistant'] },
            content: { type: 'string' }
          }
        }
      }
    },
    required: ['personaName', 'personaDescription', 'userMessage']
  },
  execute: (params: unknown) => personaRespond(params as PersonaRespondParams)
}
