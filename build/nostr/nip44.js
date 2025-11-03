import { v2 as nip44v2 } from 'nostr-tools/nip44'
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { extract as hkdfExtract } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { hexToBytes } from '@noble/hashes/utils.js'

const encoder = new TextEncoder()
function getConversationKey (privkeyA, pubkeyB, salt) {
  salt ??= 'nip44-v2'
  if (salt.length > 32) throw new Error('invalid salt length')

  const sharedX = secp256k1.getSharedSecret(privkeyA, hexToBytes('02' + pubkeyB)).subarray(1, 33)
  return hkdfExtract(sha256, sharedX, encoder.encode(salt))
}
const nip44 = {
  encrypt: nip44v2.encrypt,
  decrypt: nip44v2.decrypt,
  getConversationKey
}
export {
  nip44
}
