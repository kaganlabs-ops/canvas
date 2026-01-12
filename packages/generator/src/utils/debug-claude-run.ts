import 'dotenv/config'
import { Daytona } from '@daytonaio/sdk'

async function debug() {
  const daytona = new Daytona({
    apiKey: process.env.DAYTONA_API_KEY,
    apiUrl: process.env.DAYTONA_API_URL
  })

  const anthropicKey = process.env.ANTHROPIC_API_KEY

  console.log('Connecting to sandbox...')
  const sandbox = await daytona.get('b5f0fb29-b8ec-4144-bc12-d57fba0107e2')
  console.log('Connected!')

  // Check what's in myapp
  console.log('\n=== Checking myapp directory ===')
  const lsResult = await sandbox.process.executeCommand('ls -la /home/daytona/myapp')
  console.log(lsResult.result)

  // Check if Claude Code exists
  console.log('\n=== Checking Claude Code ===')
  const claudeCheck = await sandbox.process.executeCommand('ls -la /home/daytona/node_modules/.bin/claude')
  console.log(claudeCheck.result)

  // Try running Claude with verbose output
  console.log('\n=== Running Claude Code (with timeout) ===')
  const prompt = 'add a hello world button to the page'
  const claudePrompt = `${prompt}. Use "use client" directive at the top of any component with hooks or event handlers. Use only Tailwind CSS for styling - no styled-jsx or CSS-in-JS. Make it beautiful and modern.`

  const startTime = Date.now()

  try {
    // Run with a 90 second timeout
    const result = await sandbox.process.executeCommand(
      `cd /home/daytona/myapp && ANTHROPIC_API_KEY="${anthropicKey}" /home/daytona/node_modules/.bin/claude --dangerously-skip-permissions -p "${claudePrompt.replace(/"/g, '\\"')}" 2>&1`,
      '/home/daytona/myapp',
      {},
      90
    )

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`\nCompleted in ${elapsed}s`)
    console.log('\n=== Claude Output ===')
    console.log(result.result)
  } catch (error: any) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`\nFailed/Timeout after ${elapsed}s`)
    console.log('Error:', error.message || error)
  }
}

debug().catch(console.error)
