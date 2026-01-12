// ElevenLabs Text-to-Speech Tool
import type { ToolResult } from './index.js'

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1'

interface TextToSpeechParams {
  text: string
  voiceId?: string // Optional - will use a default voice if not provided
  modelId?: string
}

interface VoiceInfo {
  voice_id: string
  name: string
}

// Get list of available voices
export async function listVoices(): Promise<VoiceInfo[]> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not set')

  const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
    headers: { 'xi-api-key': apiKey }
  })

  if (!response.ok) {
    throw new Error(`Failed to list voices: ${response.statusText}`)
  }

  const data = await response.json()
  return data.voices.map((v: { voice_id: string; name: string }) => ({
    voice_id: v.voice_id,
    name: v.name
  }))
}

// Convert text to speech, returns audio as base64
export async function textToSpeech(params: TextToSpeechParams): Promise<ToolResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return { success: false, error: 'ELEVENLABS_API_KEY not set' }
  }

  try {
    // Use provided voiceId or default to "Rachel" (a common ElevenLabs voice)
    // Voice IDs can be found via listVoices() or the ElevenLabs dashboard
    const voiceId = params.voiceId || '21m00Tcm4TlvDq8ikWAM' // Rachel

    const response = await fetch(
      `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: params.text,
          model_id: params.modelId || 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      }
    )

    if (!response.ok) {
      const error = await response.text()
      return { success: false, error: `ElevenLabs API error: ${error}` }
    }

    // Get audio as ArrayBuffer and convert to base64
    const audioBuffer = await response.arrayBuffer()
    const base64Audio = Buffer.from(audioBuffer).toString('base64')

    return {
      success: true,
      data: {
        audioBase64: base64Audio,
        contentType: 'audio/mpeg',
        voiceId
      }
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

// Tool definition for the orchestrator
export const textToSpeechTool = {
  name: 'textToSpeech',
  description: 'Convert text to speech using ElevenLabs. Returns audio as base64-encoded MP3.',
  parameters: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'The text to convert to speech'
      },
      voiceId: {
        type: 'string',
        description: 'Optional ElevenLabs voice ID. If not provided, uses a default voice.'
      }
    },
    required: ['text']
  },
  execute: (params: unknown) => textToSpeech(params as TextToSpeechParams)
}
