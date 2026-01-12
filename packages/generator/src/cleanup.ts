import 'dotenv/config'
import { Daytona } from '@daytonaio/sdk'

async function cleanup() {
  const daytona = new Daytona({
    apiKey: process.env.DAYTONA_API_KEY,
    apiUrl: process.env.DAYTONA_API_URL
  })

  console.log('Listing all sandboxes...\n')
  const result = await daytona.list()

  console.log(`Found ${result.total} sandboxes:\n`)

  for (const sandbox of result.items) {
    console.log(`  ${sandbox.id} - ${(sandbox as any).state} - created: ${(sandbox as any).createdAt}`)
  }

  if (result.items.length === 0) {
    console.log('No sandboxes to clean up.')
    return
  }

  console.log('\nDeleting all sandboxes...\n')

  for (const sandbox of result.items) {
    try {
      console.log(`Deleting ${sandbox.id}...`)
      await daytona.delete(sandbox)
      console.log(`  Deleted!`)
    } catch (error: any) {
      console.log(`  Error: ${error.message}`)
    }
  }

  console.log('\nDone! You can now create new sandboxes.')
}

cleanup().catch(console.error)
