// CLI that orchestrates and deploys a room in one step
import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { Daytona } from '@daytonaio/sdk'
import { orchestrate } from './orchestrator.js'
import { generateClaudeCodePrompt } from './room-generator.js'

// Load .env from project root (try multiple locations)
const possibleEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(import.meta.dirname, '../../../.env')
]

for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=')
      if (key && !key.startsWith('#')) {
        process.env[key.trim()] = valueParts.join('=').trim()
      }
    })
    break
  }
}

// Use new snapshot with HeyGen SDK pre-installed, fallback to old one
const SNAPSHOT_NAME = 'nutz-nextjs-heygen'
const FALLBACK_SNAPSHOT = 'lovable-nextjs-claude'

function emit(event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({ event, ...data }))
}

interface GenerateRoomOptions {
  prompt: string
  sandboxId?: string
}

function parseArgs(): GenerateRoomOptions {
  const args = process.argv.slice(2)
  let prompt = ''
  let sandboxId: string | undefined

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--prompt' && args[i + 1]) {
      prompt = args[i + 1]
      i++
    } else if (args[i] === '--sandbox' && args[i + 1]) {
      sandboxId = args[i + 1]
      i++
    }
  }

  if (!prompt) {
    emit('error', { message: 'Missing --prompt argument' })
    process.exit(1)
  }

  return { prompt, sandboxId }
}

async function main() {
  const { prompt, sandboxId } = parseArgs()

  const apiKey = process.env.DAYTONA_API_KEY
  const apiUrl = process.env.DAYTONA_API_URL || 'https://app.daytona.io/api'
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const heygenKey = process.env.HEYGEN_API_KEY

  if (!apiKey || !anthropicKey) {
    emit('error', { message: 'Missing DAYTONA_API_KEY or ANTHROPIC_API_KEY' })
    process.exit(1)
  }

  if (!heygenKey) {
    emit('status', { message: 'Warning: HEYGEN_API_KEY not set - video rooms will not work' })
  }

  const daytona = new Daytona({ apiKey, apiUrl })
  let sandbox: Awaited<ReturnType<typeof daytona.create>> | undefined

  try {
    // Step 1: Orchestrate - analyze the prompt and create room spec
    emit('status', { message: 'Understanding your request...' })

    const orchestrationResult = await orchestrate(prompt)

    if (!orchestrationResult.success) {
      emit('error', { message: orchestrationResult.error || 'Failed to understand request' })
      process.exit(1)
    }

    if (!orchestrationResult.roomSpec) {
      emit('error', { message: 'Could not create room specification' })
      process.exit(1)
    }

    emit('status', { message: `Creating "${orchestrationResult.roomSpec.title}"...` })
    emit('roomSpec', { spec: orchestrationResult.roomSpec })

    // Log orchestration steps
    if (orchestrationResult.steps) {
      for (const step of orchestrationResult.steps) {
        emit('step', { tool: step.tool })
      }
    }

    // Step 2: Generate Claude Code prompt
    const claudePrompt = generateClaudeCodePrompt(orchestrationResult.roomSpec)
    emit('status', { message: 'Generated room template' })

    // Step 3: Create or reuse sandbox
    emit('status', { message: 'Setting up sandbox environment...' })

    // Helper to create sandbox with fallback to old snapshot
    const createSandbox = async () => {
      const envVars = {
        ANTHROPIC_API_KEY: anthropicKey,
        ...(heygenKey && { HEYGEN_API_KEY: heygenKey })
      }

      try {
        // Try new snapshot with HeyGen SDK first
        return await daytona.create({
          snapshot: SNAPSHOT_NAME,
          public: true,
          envVars
        })
      } catch {
        // Fallback to old snapshot
        emit('status', { message: `Snapshot ${SNAPSHOT_NAME} not found, using fallback...` })
        return await daytona.create({
          snapshot: FALLBACK_SNAPSHOT,
          public: true,
          envVars
        })
      }
    }

    if (sandboxId) {
      try {
        sandbox = await daytona.get(sandboxId)
        emit('status', { message: `Reusing sandbox: ${sandboxId}` })

        if ((sandbox as unknown as { state: string }).state !== 'started') {
          emit('status', { message: 'Starting sandbox...' })
          await daytona.start(sandbox)
        }
      } catch {
        sandbox = await createSandbox()
        emit('status', { message: `Created sandbox: ${sandbox.id}` })
      }
    } else {
      sandbox = await createSandbox()
      emit('status', { message: `Created sandbox: ${sandbox.id}` })
    }

    emit('sandbox', { sandboxId: sandbox.id })

    // Step 4: Run Claude Code to generate the room
    emit('status', { message: 'Building your experience...' })
    emit('assistant', { content: `Creating "${orchestrationResult.roomSpec.title}"...` })

    const fullPrompt = `${claudePrompt}. Use "use client" directive at the top of any component with hooks or event handlers. Use only Tailwind CSS for styling. Make it beautiful and modern.`

    // Write prompt to a temp file to avoid shell escaping issues
    await sandbox.fs.uploadFile(
      Buffer.from(fullPrompt, 'utf-8'),
      '/home/daytona/prompt.txt'
    )

    const genResult = await sandbox.process.executeCommand(
      `su - daytona -c 'cd /home/daytona/myapp && ANTHROPIC_API_KEY="${anthropicKey}" /home/daytona/node_modules/.bin/claude --dangerously-skip-permissions -p "$(cat /home/daytona/prompt.txt)"'`,
      '/home/daytona/myapp',
      {},
      0
    )

    const output = genResult.result || ''
    const lines = output.split('\n').slice(0, 30)
    emit('assistant', { content: lines.join('\n') + (output.split('\n').length > 30 ? '\n...' : '') })

    // Step 5: Write .env.local with API keys for the Next.js app
    const envLocalContent = [
      `ANTHROPIC_API_KEY=${anthropicKey}`,
      heygenKey ? `HEYGEN_API_KEY=${heygenKey}` : ''
    ].filter(Boolean).join('\n')

    await sandbox.fs.uploadFile(
      Buffer.from(envLocalContent, 'utf-8'),
      '/home/daytona/myapp/.env.local'
    )

    // Step 6: Start dev server
    emit('status', { message: 'Starting your experience...' })
    await sandbox.process.executeCommand('pkill -f "next dev" || true')

    await sandbox.process.createSession('devserver')
    await sandbox.process.executeSessionCommand('devserver', {
      command: 'cd /home/daytona/myapp && npm run dev',
      runAsync: true
    })

    emit('status', { message: 'Waiting for server (15s)...' })
    await new Promise(resolve => setTimeout(resolve, 15000))

    // Get preview URL
    const previewLink = await sandbox.getPreviewLink(3000)
    const previewUrl = (previewLink as unknown as { url: string })?.url || ''
    const token = (previewLink as unknown as { token: string })?.token || ''

    emit('complete', {
      previewUrl,
      previewUrlWithToken: `${previewUrl}?tkn=${token}`,
      sandboxId: sandbox.id,
      roomSpec: orchestrationResult.roomSpec
    })

  } catch (error) {
    emit('error', { message: String(error) })
    if (sandbox) {
      emit('debug', { sandboxId: sandbox.id })
    }
    process.exit(1)
  }
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
