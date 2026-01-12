// Test script for tools
import 'dotenv/config'
import { textToSpeech, listVoices } from './text-to-speech.js'
import { generateTalkingVideo, checkVideoStatus, listAvatars, listHeyGenVoices } from './generate-talking-video.js'
import { personaRespond, generatePersonaDescription } from './persona-respond.js'
import * as fs from 'fs'
import * as path from 'path'

// Load .env from project root
const envPath = path.resolve(process.cwd(), '../../.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=')
    if (key && !key.startsWith('#')) {
      process.env[key.trim()] = valueParts.join('=').trim()
    }
  })
}

async function testTextToSpeech() {
  console.log('\n=== Testing Text-to-Speech (ElevenLabs) ===\n')

  // List available voices
  console.log('Listing available voices...')
  try {
    const voices = await listVoices()
    console.log(`Found ${voices.length} voices:`)
    voices.slice(0, 5).forEach(v => console.log(`  - ${v.name}: ${v.voice_id}`))
    if (voices.length > 5) console.log(`  ... and ${voices.length - 5} more`)
  } catch (error) {
    console.error('Error listing voices:', error)
  }

  // Generate speech
  console.log('\nGenerating speech...')
  const result = await textToSpeech({
    text: 'Hello! This is a test of the ElevenLabs text to speech API.'
  })

  if (result.success) {
    const data = result.data as { audioBase64: string }
    console.log('Success! Audio generated.')
    console.log(`Audio size: ${Math.round(data.audioBase64.length / 1024)} KB (base64)`)

    // Save to file for verification
    const audioBuffer = Buffer.from(data.audioBase64, 'base64')
    fs.writeFileSync('test-audio.mp3', audioBuffer)
    console.log('Saved to test-audio.mp3')
  } else {
    console.error('Error:', result.error)
  }
}

async function testGenerateTalkingVideo() {
  console.log('\n=== Testing Talking Video (HeyGen) ===\n')

  // List available avatars
  console.log('Listing available avatars...')
  try {
    const avatars = await listAvatars()
    console.log(`Found ${avatars.length} avatars:`)
    avatars.slice(0, 5).forEach(a => console.log(`  - ${a.avatar_name}: ${a.avatar_id}`))
    if (avatars.length > 5) console.log(`  ... and ${avatars.length - 5} more`)
  } catch (error) {
    console.error('Error listing avatars:', error)
  }

  // List available voices
  console.log('\nListing available voices...')
  try {
    const voices = await listHeyGenVoices()
    console.log(`Found ${voices.length} voices:`)
    voices.slice(0, 5).forEach(v => console.log(`  - ${v.name}: ${v.voice_id}`))
    if (voices.length > 5) console.log(`  ... and ${voices.length - 5} more`)
  } catch (error) {
    console.error('Error listing voices:', error)
  }

  // Generate a video (this will be async)
  console.log('\nGenerating video...')
  const result = await generateTalkingVideo({
    text: 'Hello! This is a test of the HeyGen talking video API.'
  })

  if (result.success) {
    const data = result.data as { videoId: string }
    console.log('Video generation started!')
    console.log(`Video ID: ${data.videoId}`)
    console.log('Use checkVideoStatus to poll for completion.')

    // Check status
    console.log('\nChecking status...')
    const status = await checkVideoStatus(data.videoId)
    if (status.success) {
      console.log('Status:', JSON.stringify(status.data, null, 2))
    } else {
      console.error('Status error:', status.error)
    }
  } else {
    console.error('Error:', result.error)
  }
}

async function testPersonaRespond() {
  console.log('\n=== Testing Persona Response (Claude) ===\n')

  // Generate persona description
  console.log('Generating persona description for Steve Jobs...')
  const descResult = await generatePersonaDescription('Steve Jobs')

  if (!descResult.success) {
    console.error('Error generating description:', descResult.error)
    return
  }

  const descData = descResult.data as { name: string; description: string }
  console.log('Persona description:', descData.description)

  // Generate a response as the persona
  console.log('\nGenerating response as Steve Jobs...')
  const result = await personaRespond({
    personaName: 'Steve Jobs',
    personaDescription: descData.description,
    userMessage: 'What do you think about the current state of smartphones?'
  })

  if (result.success) {
    const data = result.data as { response: string }
    console.log('\nSteve Jobs says:')
    console.log(data.response)
  } else {
    console.error('Error:', result.error)
  }
}

// Run tests based on command line argument
const testType = process.argv[2]

switch (testType) {
  case 'tts':
    testTextToSpeech()
    break
  case 'video':
    testGenerateTalkingVideo()
    break
  case 'persona':
    testPersonaRespond()
    break
  default:
    console.log('Usage: tsx test-tools.ts <tts|video|persona>')
    console.log('\nRunning all tests...')
    testTextToSpeech()
      .then(() => testGenerateTalkingVideo())
      .then(() => testPersonaRespond())
}
