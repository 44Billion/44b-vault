// maybe make them /apis/profile.js
import { relay } from 'nostr'
import { getSvgAvatar } from 'avatar'

// kinds 0 and 10002
const hardCodedProfileRelays = [
  'wss://purplepag.es',
  'wss://user.kindpag.es',
  'wss://relay.nostr.band' // indexer
]
const defaultNip65Relays = [
  'wss://nostr-pub.wellorder.net',
  'wss://relay.damus.io',
  'wss://relay.primal.net'
]

const profilesByPubkey = {}
export async function getProfile (pubkey) {
  if (profilesByPubkey[pubkey]) return profilesByPubkey[pubkey]
  let profile
  let isntFallback
  try {

    isntFallback = true
  } catch (err) {
    isntFallback = false
    console.log(err.stack)
  }
  if (!profile) profile = await getSvgAvatar(pubkey)

  if (isntFallback) {
    profilesByPubkey[pubkey] = profile
    setTimeout(() => { delete profilesByPubkey[pubkey] }, 3 * 60 * 1000)
  }
  return profile
}

export async function setProfile (profile) {

}
