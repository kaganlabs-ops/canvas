import 'dotenv/config'
import { Daytona, Image } from '@daytonaio/sdk'

async function createSnapshot() {
  const daytona = new Daytona({
    apiKey: process.env.DAYTONA_API_KEY,
    apiUrl: process.env.DAYTONA_API_URL
  })

  console.log('=== Creating Lovable Base Snapshot ===\n')

  // First, list existing snapshots
  console.log('Checking existing snapshots...')
  const existingSnapshots = await daytona.snapshot.list()
  console.log(`Found ${existingSnapshots.total} existing snapshots:`)
  for (const snap of existingSnapshots.items) {
    console.log(`  - ${snap.name} (${snap.state})`)
  }

  // Check if our snapshot already exists
  const snapshotName = 'nutz-nextjs-heygen'
  const existing = existingSnapshots.items.find(s => s.name === snapshotName)
  if (existing) {
    console.log(`\nSnapshot "${snapshotName}" already exists!`)
    console.log('To recreate, delete it first.')
    return
  }

  // Create a custom image with Node.js 20, Claude Code, Next.js, and HeyGen Streaming SDK pre-installed
  // Using the official node image as base
  console.log('\nBuilding custom image with Node.js + Claude Code + Next.js + HeyGen SDK...')

  const image = Image.base('node:20-slim')
    .runCommands(
      // Install basic dependencies
      'apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*',
      // Create daytona user and directories
      'useradd -m -s /bin/bash daytona || true',
      'mkdir -p /home/daytona/myapp /home/daytona/node_modules',
      'chown -R daytona:daytona /home/daytona'
    )
    .workdir('/home/daytona')
    .runCommands(
      // Install Claude Code CLI globally in /home/daytona
      'cd /home/daytona && npm init -y && npm install @anthropic-ai/claude-code',
      // Create Next.js app
      'cd /home/daytona && npx create-next-app@latest myapp --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --yes',
      // Install HeyGen Streaming Avatar SDK and livekit-client for video rooms
      'cd /home/daytona/myapp && npm install @heygen/streaming-avatar livekit-client',
      // Fix permissions
      'chown -R daytona:daytona /home/daytona'
    )
    .env({
      HOME: '/home/daytona',
      PATH: '/home/daytona/node_modules/.bin:/usr/local/bin:/usr/bin:/bin'
    })

  console.log('\nCreating snapshot (this may take 3-5 minutes)...')
  console.log('Dockerfile:\n')
  console.log(image.dockerfile)
  console.log('\n')

  try {
    const snapshot = await daytona.snapshot.create(
      {
        name: snapshotName,
        image: image,
        resources: {
          cpu: 2,
          memory: 4,
          disk: 10  // Max allowed on current tier
        }
      },
      {
        onLogs: (chunk) => process.stdout.write(chunk),
        timeout: 600 // 10 minute timeout
      }
    )

    console.log('\n\n=== Snapshot Created Successfully ===')
    console.log(`Name: ${snapshot.name}`)
    console.log(`State: ${snapshot.state}`)
    console.log(`\nYou can now use this snapshot in generate-for-api.ts:`)
    console.log(`  daytona.create({ snapshot: '${snapshotName}', ... })`)
  } catch (error) {
    console.error('\nError creating snapshot:', error)
  }
}

createSnapshot().catch(console.error)
