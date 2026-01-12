// @nutz/tools - Tool integrations for generative experiences

export interface Tool {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (params: unknown) => Promise<ToolResult>
}

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
}

// Re-export all tools
export { textToSpeech, listVoices } from './text-to-speech.js'
export { generateTalkingVideo, checkVideoStatus, waitForVideo, listAvatars, listHeyGenVoices } from './generate-talking-video.js'
export { personaRespond, generatePersonaDescription } from './persona-respond.js'

// Tool registry for the orchestrator
export { tools, executeTool, toolDefinitions } from './registry.js'

// Orchestrator
export { orchestrate } from './orchestrator.js'

// Room Generator
export { generateRoomFiles, generateClaudeCodePrompt } from './room-generator.js'
