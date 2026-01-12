// Orchestrator - The brain that decides which tools to use based on user prompts
import Anthropic from '@anthropic-ai/sdk'
import { executeTool, toolDefinitions } from './registry.js'

interface OrchestrationResult {
  success: boolean
  roomSpec?: RoomSpec
  error?: string
  steps?: OrchestrationStep[]
}

interface OrchestrationStep {
  tool: string
  params: Record<string, unknown>
  result: unknown
}

interface RoomSpec {
  type: 'conversation' | 'video_conversation' | 'quiz' | 'tutorial' | 'custom'
  title: string
  description: string
  persona?: {
    name: string
    description: string
    imageUrl?: string
    introVideoUrl?: string
  }
  features: string[]
  apiEndpoints: {
    chat?: string
    tts?: string
    video?: string
    heygenToken?: string
  }
}

const ORCHESTRATOR_SYSTEM_PROMPT = `You are the nutz orchestrator. Your job is to analyze user requests and create interactive "rooms" - web experiences that combine AI, video, and audio.

When a user describes an experience they want, you must:
1. Understand what type of room they need
2. Use the available tools to gather/generate the necessary assets
3. Return a room specification that can be used to generate the final experience

AVAILABLE ROOM TYPES:
- "video_conversation": A LIVE VIDEO room where users can video chat with a persona using real-time streaming avatar (like a Zoom call). Use this when the user mentions "video chat", "video call", "face to face", "see them", "video", or wants a more immersive experience.
- "conversation": A text-only chat room where users can chat with a persona (simpler, faster)
- "quiz": An interactive quiz experience
- "tutorial": An educational/learning experience
- "custom": Any other type of interactive experience

AVAILABLE TOOLS:
- textToSpeech: Convert text to audio using ElevenLabs
- generateTalkingVideo: Create a talking avatar video using HeyGen (can use a photo URL)
- personaRespond: Generate responses as a specific persona using Claude
- generatePersonaDescription: Generate a description of a persona for role-playing

WORKFLOW FOR VIDEO CHAT REQUESTS ("I want to video chat with X", "I want to see X", etc.):
1. First, analyze who they want to talk to
2. Use generatePersonaDescription to create a persona description
3. Return a room spec with type "video_conversation" and include persona details

WORKFLOW FOR TEXT CHAT REQUESTS ("I want to talk to X", "chat with X"):
1. First, analyze who they want to talk to
2. Use generatePersonaDescription to create a persona description
3. Return a room spec with type "conversation" and include persona details

IMPORTANT: Default to "video_conversation" for persona requests unless the user specifically asks for text-only chat.

Return your analysis and room specification in JSON format.`

export async function orchestrate(userPrompt: string): Promise<OrchestrationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { success: false, error: 'ANTHROPIC_API_KEY not set' }
  }

  const client = new Anthropic({ apiKey })
  const steps: OrchestrationStep[] = []

  try {
    // First, have Claude analyze the request and decide what to do
    const analysisResponse = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: ORCHESTRATOR_SYSTEM_PROMPT,
      tools: toolDefinitions as Anthropic.Tool[],
      messages: [
        {
          role: 'user',
          content: `User request: "${userPrompt}"

Analyze this request and determine:
1. What type of room is needed
2. What persona or content is involved
3. What tools need to be called

If this is a "talk to someone" request, first generate a persona description, then create a test response to verify it works.

After using tools, provide a final room specification in JSON format.`
        }
      ]
    })

    // Process tool calls
    let messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: `User request: "${userPrompt}"

Analyze this request and determine:
1. What type of room is needed
2. What persona or content is involved
3. What tools need to be called

If this is a "talk to someone" request, first generate a persona description, then create a test response to verify it works.

After using tools, provide a final room specification in JSON format.`
      }
    ]

    let currentResponse = analysisResponse
    let roomSpec: RoomSpec | undefined

    // Tool use loop
    while (currentResponse.stop_reason === 'tool_use') {
      const assistantContent = currentResponse.content
      messages.push({ role: 'assistant', content: assistantContent })

      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of assistantContent) {
        if (block.type === 'tool_use') {
          console.log(`[Orchestrator] Calling tool: ${block.name}`)
          console.log(`[Orchestrator] Params:`, JSON.stringify(block.input, null, 2))

          const result = await executeTool(block.name, block.input as Record<string, unknown>)

          steps.push({
            tool: block.name,
            params: block.input as Record<string, unknown>,
            result: result.data
          })

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result)
          })
        }
      }

      messages.push({ role: 'user', content: toolResults })

      // Continue the conversation
      currentResponse = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: ORCHESTRATOR_SYSTEM_PROMPT,
        tools: toolDefinitions as Anthropic.Tool[],
        messages
      })
    }

    // Extract the final response and room spec
    for (const block of currentResponse.content) {
      if (block.type === 'text') {
        // Try to extract JSON room spec from the response
        const jsonMatch = block.text.match(/```json\s*([\s\S]*?)\s*```/)
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1])
            // Normalize roomType -> type if needed
            if (parsed.roomType && !parsed.type) {
              parsed.type = parsed.roomType
              delete parsed.roomType
            }
            roomSpec = parsed
          } catch {
            // Try to find raw JSON
            const rawJsonMatch = block.text.match(/\{[\s\S]*"(type|roomType)"[\s\S]*\}/)
            if (rawJsonMatch) {
              try {
                const parsed = JSON.parse(rawJsonMatch[0])
                // Normalize roomType -> type if needed
                if (parsed.roomType && !parsed.type) {
                  parsed.type = parsed.roomType
                  delete parsed.roomType
                }
                roomSpec = parsed
              } catch {
                console.error('Failed to parse room spec JSON')
              }
            }
          }
        }
      }
    }

    if (!roomSpec) {
      // Create a default room spec based on the steps taken
      const personaStep = steps.find(s => s.tool === 'personaRespond' || s.tool === 'generatePersonaDescription')
      if (personaStep) {
        const personaData = personaStep.result as { name?: string; description?: string; response?: string }

        // Detect if this should be a video conversation based on the original prompt
        const isVideoRequest = /video|see|face|zoom|call|watch/i.test(userPrompt)

        roomSpec = {
          type: isVideoRequest ? 'video_conversation' : 'conversation',
          title: isVideoRequest
            ? `Video Chat with ${personaData.name || 'Unknown'}`
            : `Talk to ${personaData.name || 'Unknown'}`,
          description: personaData.description || 'Have a conversation',
          persona: {
            name: personaData.name || 'Unknown',
            description: personaData.description || ''
          },
          features: isVideoRequest
            ? ['real-time video', 'live avatar', 'persona responses']
            : ['real-time chat', 'persona responses'],
          apiEndpoints: isVideoRequest
            ? { chat: '/api/chat', heygenToken: '/api/heygen-token' }
            : { chat: '/api/chat' }
        }
      }
    }

    return {
      success: true,
      roomSpec,
      steps
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

// Test the orchestrator
export async function testOrchestrator() {
  console.log('\n=== Testing Orchestrator ===\n')

  const result = await orchestrate('I want to talk to Steve Jobs')

  if (result.success) {
    console.log('Orchestration successful!')
    console.log('\nSteps taken:')
    result.steps?.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step.tool}`)
    })
    console.log('\nRoom Spec:')
    console.log(JSON.stringify(result.roomSpec, null, 2))
  } else {
    console.error('Orchestration failed:', result.error)
  }
}
