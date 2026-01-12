// CLI wrapper for the orchestrator
import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
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

// Output JSON events
function emit(event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({ event, ...data }))
}

// Parse command line arguments
function parseArgs(): { prompt: string } {
  const args = process.argv.slice(2)
  let prompt = ''

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--prompt' && args[i + 1]) {
      prompt = args[i + 1]
      i++
    }
  }

  if (!prompt) {
    emit('error', { message: 'Missing --prompt argument' })
    process.exit(1)
  }

  return { prompt }
}

async function main() {
  const { prompt } = parseArgs()

  emit('status', { message: 'Analyzing your request...' })

  // Run the orchestrator
  const result = await orchestrate(prompt)

  if (!result.success) {
    emit('error', { message: result.error || 'Orchestration failed' })
    process.exit(1)
  }

  // Log the steps taken
  if (result.steps) {
    for (const step of result.steps) {
      emit('step', { tool: step.tool, params: step.params })
    }
  }

  // If we have a room spec, generate the Claude Code prompt
  if (result.roomSpec) {
    emit('roomSpec', { spec: result.roomSpec })

    const claudePrompt = generateClaudeCodePrompt(result.roomSpec)
    emit('claudePrompt', { prompt: claudePrompt })

    emit('status', { message: 'Room specification ready. Ready to deploy.' })
  }

  emit('complete', { roomSpec: result.roomSpec })
}

main().catch(error => {
  emit('error', { message: String(error) })
  process.exit(1)
})
