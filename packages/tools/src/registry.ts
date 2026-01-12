// Tool Registry - Central registry of all available tools for the orchestrator
import type { Tool, ToolResult } from './index.js'
import { textToSpeechTool, textToSpeech } from './text-to-speech.js'
import { generateTalkingVideoTool, generateTalkingVideo, checkVideoStatus, waitForVideo } from './generate-talking-video.js'
import { personaRespondTool, personaRespond, generatePersonaDescription } from './persona-respond.js'

// Generate persona description tool definition
const generatePersonaDescriptionTool: Tool = {
  name: 'generatePersonaDescription',
  description: 'Generate a persona description for a famous person or character. Use this first when setting up a conversation room.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'The name of the person or character (e.g., "Steve Jobs", "Albert Einstein")'
      }
    },
    required: ['name']
  },
  execute: async (params) => generatePersonaDescription(params.name as string)
}

// All available tools
export const tools: Tool[] = [
  textToSpeechTool,
  generateTalkingVideoTool,
  personaRespondTool,
  generatePersonaDescriptionTool
]

// Tool definitions in the format Claude expects for tool_use
export const toolDefinitions = tools.map(tool => ({
  name: tool.name,
  description: tool.description,
  input_schema: tool.parameters
}))

// Execute a tool by name
export async function executeTool(
  toolName: string,
  params: Record<string, unknown>
): Promise<ToolResult> {
  // Use type assertions to handle the params correctly
  const p = params as unknown

  switch (toolName) {
    case 'textToSpeech':
      return textToSpeech(p as Parameters<typeof textToSpeech>[0])

    case 'generateTalkingVideo':
      return generateTalkingVideo(p as Parameters<typeof generateTalkingVideo>[0])

    case 'checkVideoStatus':
      return checkVideoStatus(params.videoId as string)

    case 'waitForVideo':
      return waitForVideo(params.videoId as string, params.maxWaitMs as number | undefined)

    case 'personaRespond':
      return personaRespond(p as Parameters<typeof personaRespond>[0])

    case 'generatePersonaDescription':
      return generatePersonaDescription(params.name as string)

    default:
      return { success: false, error: `Unknown tool: ${toolName}` }
  }
}

// Get tool by name
export function getTool(name: string): Tool | undefined {
  return tools.find(t => t.name === name)
}
