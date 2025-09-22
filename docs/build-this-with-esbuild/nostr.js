
import { getPublicKey as getPublicKeyFromUint8Array } from 'nostr-tools/pure'
export * as nip04 from 'nostr-tools/nip04'
export { npubEncode } from 'nostr-tools/nip19'
import { v2 as nip44v2 } from 'nostr-tools/nip44'
import { secp256k1 } from '@noble/curves/secp256k1'
import { extract as hkdfExtract } from '@noble/hashes/hkdf'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, hexToBytes } from 'helpers'

function getConversationKey (privkeyA, pubkeyB, salt) {
  salt ??= 'nip44-v2'
  if (salt.length > 32) throw new Error('invalid salt length')

  const sharedX = secp256k1.getSharedSecret(privkeyA, '02' + pubkeyB).subarray(1, 33)
  return hkdfExtract(sha256, sharedX, salt)
}
const nip44 = {
  encrypt: nip44v2.encrypt,
  decrypt: nip44v2.decrypt,
  getConversationKey
}
export {
  nip44
}

// deterministic
export function obfuscate (privkey, payload, salt) {
  salt ??= 'default'
  const key = hkdfExtract(sha256, privkey, salt)
  return bytesToHex(sha256(key + payload))
}

// https://github.com/paulmillr/noble-secp256k1/blob/b032053763c0d4ba107c18fee28344f64242b075/index.js#L457
export function generatePrivateKey () {
  const randomBytes = crypto.getRandomValues(new Uint8Array(40))
  const B256 = 2n ** 256n // secp256k1 is short weierstrass curve
  const N = B256 - 0x14551231950b75fc4402da1732fc9bebfn; // curve (group) order
  const bytesToNumber = b => BigInt('0x' + (bytesToHex(b) || '0'))
  const mod = (a, b) => { let r = a % b; return r >= 0n ? r : b + r; } // mod division
  const num = mod(bytesToNumber(randomBytes), N - 1n) + 1n // takes at least n+8 bytes
  return num.toString(16).padStart(64, '0')
}

export function getPublicKey (privkey) {
  return getPublicKeyFromUint8Array(hexToBytes(privkey))
}
