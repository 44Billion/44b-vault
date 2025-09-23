import assert from 'node:assert/strict'
import { it } from 'node:test'

it('imports are resolved correctly', async () => {
  const { npubEncode } = await import('nostr')
  const { getSvgAvatar } = await import('avatar')
  const { getRandomId } = await import('helpers')

  assert(typeof npubEncode === 'function', 'npubEncode should be a function')
  assert(typeof getSvgAvatar === 'function', 'getSvgAvatar should be a function')
  assert(typeof getRandomId === 'function', 'getRandomId should be a function')
})
