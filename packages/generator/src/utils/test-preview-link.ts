import 'dotenv/config'
import { Daytona } from '@daytonaio/sdk'

async function test() {
  const daytona = new Daytona({
    apiKey: process.env.DAYTONA_API_KEY,
    apiUrl: process.env.DAYTONA_API_URL
  })

  console.log('Getting sandbox...')
  const sandbox = await daytona.get('b5f0fb29-b8ec-4144-bc12-d57fba0107e2')

  console.log('Getting preview link...')
  const previewLink = await sandbox.getPreviewLink(3000)

  console.log('\n=== Preview Link Object ===')
  console.log('Full object:', JSON.stringify(previewLink, null, 2))
  console.log('\nType:', typeof previewLink)
  console.log('Keys:', Object.keys(previewLink as any))

  // Try different property access
  const obj = previewLink as any
  console.log('\n=== Property Access ===')
  console.log('obj.url:', obj.url)
  console.log('obj.token:', obj.token)
  console.log('Direct string:', String(previewLink))

  // Build the URL with token
  if (obj.url && obj.token) {
    console.log('\n=== Final URL ===')
    console.log(`${obj.url}?tkn=${obj.token}`)
  }
}

test().catch(console.error)
