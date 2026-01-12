// HeyGen Talking Video Generation Tool
import type { ToolResult } from './index.js'

const HEYGEN_API_URL = 'https://api.heygen.com'

interface GenerateVideoParams {
  text: string
  avatarId?: string
  voiceId?: string
  imageUrl?: string // For photo avatars - use an image instead of preset avatar
}

interface AvatarInfo {
  avatar_id: string
  avatar_name: string
}

interface VoiceInfo {
  voice_id: string
  name: string
}

// List available avatars
export async function listAvatars(): Promise<AvatarInfo[]> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) throw new Error('HEYGEN_API_KEY not set')

  const response = await fetch(`${HEYGEN_API_URL}/v2/avatars`, {
    headers: { 'X-Api-Key': apiKey }
  })

  if (!response.ok) {
    throw new Error(`Failed to list avatars: ${response.statusText}`)
  }

  const data = await response.json()
  return data.data?.avatars || []
}

// List available voices
export async function listHeyGenVoices(): Promise<VoiceInfo[]> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) throw new Error('HEYGEN_API_KEY not set')

  const response = await fetch(`${HEYGEN_API_URL}/v2/voices`, {
    headers: { 'X-Api-Key': apiKey }
  })

  if (!response.ok) {
    throw new Error(`Failed to list voices: ${response.statusText}`)
  }

  const data = await response.json()
  return data.data?.voices || []
}

// Generate a talking avatar video
export async function generateTalkingVideo(params: GenerateVideoParams): Promise<ToolResult> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) {
    return { success: false, error: 'HEYGEN_API_KEY not set' }
  }

  try {
    // Build the character config based on whether we're using a photo or preset avatar
    let character: Record<string, unknown>

    if (params.imageUrl) {
      // Use photo avatar with provided image URL
      character = {
        type: 'talking_photo',
        talking_photo_url: params.imageUrl
      }
    } else {
      // Use preset avatar
      character = {
        type: 'avatar',
        avatar_id: params.avatarId || 'Angela-inTshirt-20220820',
        avatar_style: 'normal'
      }
    }

    const requestBody = {
      video_inputs: [
        {
          character,
          voice: {
            type: 'text',
            input_text: params.text,
            voice_id: params.voiceId || '1bd001e7e50f421d891986aad5158bc8',
            speed: 1.0
          },
          background: {
            type: 'color',
            value: '#000000'
          }
        }
      ],
      dimension: {
        width: 1280,
        height: 720
      }
    }

    const response = await fetch(`${HEYGEN_API_URL}/v2/video/generate`, {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const error = await response.text()
      return { success: false, error: `HeyGen API error: ${error}` }
    }

    const data = await response.json()

    return {
      success: true,
      data: {
        videoId: data.data?.video_id,
        status: 'pending'
      }
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

// Check video generation status
export async function checkVideoStatus(videoId: string): Promise<ToolResult> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) {
    return { success: false, error: 'HEYGEN_API_KEY not set' }
  }

  try {
    const response = await fetch(`${HEYGEN_API_URL}/v1/video_status.get?video_id=${videoId}`, {
      headers: { 'X-Api-Key': apiKey }
    })

    if (!response.ok) {
      const error = await response.text()
      return { success: false, error: `HeyGen API error: ${error}` }
    }

    const data = await response.json()

    return {
      success: true,
      data: {
        videoId,
        status: data.data?.status,
        videoUrl: data.data?.video_url,
        thumbnailUrl: data.data?.thumbnail_url
      }
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

// Wait for video to complete (polls status)
export async function waitForVideo(videoId: string, maxWaitMs = 300000): Promise<ToolResult> {
  const startTime = Date.now()
  const pollInterval = 5000 // 5 seconds

  while (Date.now() - startTime < maxWaitMs) {
    const result = await checkVideoStatus(videoId)

    if (!result.success) {
      return result
    }

    const status = (result.data as { status: string }).status

    if (status === 'completed') {
      return result
    }

    if (status === 'failed') {
      return { success: false, error: 'Video generation failed' }
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }

  return { success: false, error: 'Video generation timed out' }
}

// Tool definition for the orchestrator
export const generateTalkingVideoTool = {
  name: 'generateTalkingVideo',
  description: 'Generate a talking avatar video using HeyGen. Can use a preset avatar or a custom photo.',
  parameters: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'The text for the avatar to speak'
      },
      imageUrl: {
        type: 'string',
        description: 'URL of an image to use as a talking photo avatar. If not provided, uses a preset avatar.'
      },
      avatarId: {
        type: 'string',
        description: 'HeyGen avatar ID to use (only if imageUrl is not provided)'
      },
      voiceId: {
        type: 'string',
        description: 'HeyGen voice ID to use for speech'
      }
    },
    required: ['text']
  },
  execute: (params: unknown) => generateTalkingVideo(params as GenerateVideoParams)
}
