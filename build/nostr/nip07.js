import { extract as hkdfExtract } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from 'helpers'

// deterministic
export function obfuscate (privkey, payload, salt) {
  salt ??= 'default'
  const key = hkdfExtract(sha256, privkey, salt)
  return bytesToHex(sha256(key + payload))
}
