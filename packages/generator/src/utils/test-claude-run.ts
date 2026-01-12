import 'dotenv/config'
import { Daytona } from '@daytonaio/sdk'

async function test() {
  const daytona = new Daytona({
    apiKey: process.env.DAYTONA_API_KEY,
    apiUrl: process.env.DAYTONA_API_URL
  })

  const anthropicKey = process.env.ANTHROPIC_API_KEY

  // Use existing sandbox
  console.log('Connecting to sandbox...')
  const sandbox = await daytona.get('b5f0fb29-b8ec-4144-bc12-d57fba0107e2')
  console.log('Connected!')

  // Run a very simple Claude command with a timeout
  console.log('\nRunning Claude Code with a simple prompt...')
  console.log('(Will timeout after 60 seconds)\n')

  const startTime = Date.now()

  try {
    const result = await sandbox.process.executeCommand(
      `cd /home/daytona/myapp && ANTHROPIC_API_KEY="${anthropicKey}" /home/daytona/node_modules/.bin/claude --dangerously-skip-permissions -p "Create a file called test.txt with the text 'hello world'"`,
      '/home/daytona/myapp',
      {},
      60 // 60 second timeout
    )

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`Completed in ${elapsed}s`)
    console.log('Result:', result.result?.slice(0, 500))

    // Check if file was created
    const check = await sandbox.process.executeCommand('cat /home/daytona/myapp/test.txt')
    console.log('\nFile contents:', check.result)

  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`Failed after ${elapsed}s`)
    console.error('Error:', error)
  }
}

test().catch(console.error)
