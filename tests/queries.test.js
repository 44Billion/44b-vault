import assert from 'node:assert/strict'
import { it } from 'node:test'
import { getProfile } from 'queries'

it('#getProfile', async () => {
  let kind0 = {
    id: 'f'.repeat(64),
    pubkey: 'a'.repeat(64),
    created_at: 1672531200,
    kind: 0,
    tags: [
      ['display_name', 'Alice Wonderland 2'],
      ['about', 'Just a test user 2'],
      ['picture', 'https://example.com/alice2.png']
    ],
    content: JSON.stringify({
      name: 'Alice',
      display_name: 'Alice Wonderland',
      about: 'Just a test user',
      picture: 'https://example.com/alice.png'
    }),
    sig: 'b'.repeat(128)
  }
  const _nostrRelays = { async getEvents () { return { result: [kind0], errors: [] } } }
  const _getRelays = async () => ({ read: [], write: [] })
  const _getSvgAvatar = async () => 'data:image/svg+xml,<svg></svg>'
  const profile = await getProfile(
    'a'.repeat(64),
    { _nostrRelays, _getRelays, _getSvgAvatar }
  )
  assert.equal(profile.name, 'Alice Wonderland 2')
  assert.equal(profile.about, 'Just a test user 2')
  assert.equal(profile.picture, 'https://example.com/alice2.png')
  assert.equal(profile.npub.length, 63)
  assert.equal(profile.meta.events[0].id, kind0.id)

  // from cache
  const profile2 = await getProfile(
    'a'.repeat(64),
    { _nostrRelays, _getRelays, _getSvgAvatar }
  )
  assert.equal(profile2, profile)

  kind0 = {
    ...kind0,
    id: 'e'.repeat(64),
    pubkey: 'b'.repeat(64),
    tags: []
  }
  // no tags, but content
  const profile3 = await getProfile(
    'b'.repeat(64),
    { _nostrRelays, _getRelays, _getSvgAvatar }
  )
  assert.equal(profile3.name, 'Alice')
  assert.equal(profile3.about, 'Just a test user')
  assert.equal(profile3.picture, 'https://example.com/alice.png')
  assert.equal(profile3.npub.length, 63)
  assert.equal(profile3.meta.events[0].id, kind0.id)
})
