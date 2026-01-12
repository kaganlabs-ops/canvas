import 'dotenv/config'
import { Daytona } from '@daytonaio/sdk'

async function startSandbox(sandboxId: string) {
  const daytona = new Daytona({
    apiKey: process.env.DAYTONA_API_KEY,
    apiUrl: process.env.DAYTONA_API_URL
  })

  console.log(`Getting sandbox ${sandboxId}...`)
  const sandbox = await daytona.get(sandboxId)

  // Log the sandbox structure to understand it
  console.log('Sandbox object keys:', Object.keys(sandbox))
  console.log('Sandbox state:', (sandbox as any).state || (sandbox as any).instance?.state || 'unknown')

  // Try to start regardless
  try {
    console.log('Starting sandbox...')
    await daytona.start(sandbox)
    console.log('Sandbox started!')
  } catch (e: any) {
    if (e.message?.includes('already started') || e.message?.includes('already running')) {
      console.log('Sandbox is already running')
    } else {
      throw e
    }
  }

  // Verify it's working
  console.log('Verifying sandbox...')
  const result = await sandbox.process.executeCommand('echo "Sandbox is ready!"')
  console.log(result.result)
}

const sandboxId = process.argv[2] || 'b5f0fb29-b8ec-4144-bc12-d57fba0107e2'
startSandbox(sandboxId).catch(console.error)
