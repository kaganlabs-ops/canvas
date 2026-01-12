import 'dotenv/config'
import { Daytona } from '@daytonaio/sdk'

// Pre-built snapshot with Claude Code + Next.js already installed
const SNAPSHOT_NAME = 'lovable-nextjs-claude'

// Output JSON events for the API to parse
function emit(event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({ event, ...data }))
}

interface GenerateOptions {
  prompt: string
  sandboxId?: string
}

async function generateApp(options: GenerateOptions) {
  const { prompt, sandboxId } = options

  const apiKey = process.env.DAYTONA_API_KEY
  const apiUrl = process.env.DAYTONA_API_URL || 'https://app.daytona.io/api'
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey || !anthropicKey) {
    emit('error', { message: 'Missing DAYTONA_API_KEY or ANTHROPIC_API_KEY' })
    process.exit(1)
  }

  const daytona = new Daytona({ apiKey, apiUrl })
  let sandbox

  try {
    // Step 1: Get or create sandbox from snapshot
    emit('status', { message: 'Setting up sandbox environment...' })

    if (sandboxId) {
      try {
        sandbox = await daytona.get(sandboxId)
        emit('status', { message: `Reusing sandbox: ${sandboxId}` })

        // Start the sandbox if it's not running
        if ((sandbox as any).state !== 'started') {
          emit('status', { message: 'Starting sandbox...' })
          await daytona.start(sandbox)
          emit('status', { message: 'Sandbox started' })
        }
      } catch {
        // Create new sandbox from snapshot (has Claude Code + Next.js pre-installed)
        emit('status', { message: 'Creating sandbox from snapshot...' })
        sandbox = await daytona.create({
          snapshot: SNAPSHOT_NAME,
          public: true,
          envVars: { ANTHROPIC_API_KEY: anthropicKey }
        })
        emit('status', { message: `Created sandbox from snapshot: ${sandbox.id}` })
      }
    } else {
      // Create new sandbox from snapshot (has Claude Code + Next.js pre-installed)
      emit('status', { message: 'Creating sandbox from snapshot...' })
      sandbox = await daytona.create({
        snapshot: SNAPSHOT_NAME,
        public: true,
        envVars: { ANTHROPIC_API_KEY: anthropicKey }
      })
      emit('status', { message: `Created sandbox: ${sandbox.id}` })
    }

    emit('sandbox', { sandboxId: sandbox.id })

    // Snapshot already has Claude Code + Next.js installed, go straight to generation
    // Run Claude Code
    emit('status', { message: 'Running Claude Code to build your app...' })
    emit('assistant', { content: `Building your app based on: "${prompt}"` })

    const claudePrompt = `${prompt}. Use "use client" directive at the top of any component with hooks or event handlers. Use only Tailwind CSS for styling - no styled-jsx or CSS-in-JS. Make it beautiful and modern.`

    // Run as daytona user (not root) because Claude Code blocks root for security
    const genResult = await sandbox.process.executeCommand(
      `su - daytona -c 'cd /home/daytona/myapp && ANTHROPIC_API_KEY="${anthropicKey}" /home/daytona/node_modules/.bin/claude --dangerously-skip-permissions -p "${claudePrompt.replace(/"/g, '\\"').replace(/'/g, "'\\''")}"'`,
      '/home/daytona/myapp',
      {},
      0
    )

    const output = genResult.result || ''
    const lines = output.split('\n').slice(0, 30)
    emit('assistant', { content: lines.join('\n') + (output.split('\n').length > 30 ? '\n...' : '') })

    // Step 6: Start dev server
    emit('status', { message: 'Starting development server...' })
    await sandbox.process.executeCommand('pkill -f "next dev" || true')

    await sandbox.process.createSession('devserver')
    await sandbox.process.executeSessionCommand('devserver', {
      command: 'cd /home/daytona/myapp && npm run dev',
      runAsync: true
    })

    emit('status', { message: 'Waiting for server to start (15s)...' })
    await new Promise(resolve => setTimeout(resolve, 15000))

    // Get preview URL
    const previewLink = await sandbox.getPreviewLink(3000)
    const previewUrl = (previewLink as any)?.url || ''
    const token = (previewLink as any)?.token || ''

    emit('complete', {
      previewUrl,
      previewUrlWithToken: `${previewUrl}?tkn=${token}`,
      sandboxId: sandbox.id
    })

  } catch (error) {
    emit('error', { message: String(error) })
    if (sandbox) {
      emit('debug', { sandboxId: sandbox.id })
    }
    process.exit(1)
  }
}

// Parse args: --prompt "..." [--sandbox "..."]
function parseArgs(): GenerateOptions {
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

const options = parseArgs()
generateApp(options)
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
