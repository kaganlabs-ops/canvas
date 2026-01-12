// HeyGen Streaming Avatar - Real-time video conversation

interface StreamingTokenResponse {
  error: unknown | null
  data: {
    token: string
  }
}

interface StreamingSession {
  sessionId: string
  accessToken: string
  url: string
}

/**
 * Get an access token for HeyGen Streaming Avatar API
 * This token is used to initialize the StreamingAvatar SDK on the client
 */
export async function getStreamingToken(): Promise<string> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) {
    throw new Error('HEYGEN_API_KEY not set')
  }

  const response = await fetch('https://api.heygen.com/v1/streaming.create_token', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get streaming token: ${error}`)
  }

  const data: StreamingTokenResponse = await response.json()

  if (data.error !== null) {
    throw new Error(`HeyGen API error: ${JSON.stringify(data.error)}`)
  }

  return data.data.token
}

/**
 * List available avatars that can be used for streaming
 */
export async function listStreamingAvatars(): Promise<unknown[]> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) {
    throw new Error('HEYGEN_API_KEY not set')
  }

  const response = await fetch('https://api.heygen.com/v1/streaming.list', {
    method: 'GET',
    headers: {
      'x-api-key': apiKey
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to list streaming avatars: ${error}`)
  }

  const data = await response.json()
  return data.data || []
}

/**
 * List available voices for streaming avatars
 */
export async function listStreamingVoices(): Promise<unknown[]> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) {
    throw new Error('HEYGEN_API_KEY not set')
  }

  const response = await fetch('https://api.heygen.com/v2/voices', {
    method: 'GET',
    headers: {
      'x-api-key': apiKey
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to list voices: ${error}`)
  }

  const data = await response.json()
  return data.data?.voices || []
}

// Export tool definition for the registry
export const heygenStreamingTool = {
  name: 'getHeygenStreamingToken',
  description: 'Get an access token for HeyGen Streaming Avatar API. This enables real-time video avatar conversations.',
  parameters: {
    type: 'object' as const,
    properties: {},
    required: [] as string[]
  },
  execute: async () => {
    const token = await getStreamingToken()
    return {
      success: true,
      data: { token }
    }
  }
}
