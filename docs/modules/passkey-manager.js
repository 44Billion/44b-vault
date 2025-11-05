import { npubEncode, getPublicKey, generatePrivateKey } from 'nostr'
import { getProfile } from 'queries'
import { bytesToHex, hexToBytes } from 'helpers/misc.js'
import { t } from 'translator'
import NostrSigner from 'nostr-signer'

// Notes:
// - We now store the Nostr private key encrypted inside the passkey large-blob
//   extension, using a deterministic key derived from the PRF extension so we
//   never persist the private key in clear text inside the passkey metadata.
// - The passkey user handle (`user.id`) stores the public key so that a synced
//   passkey can still be identified across devices without leaking the private key.
// - Some authenticators/browsers may require multiple prompts: one for the
//   passkey assertion and another for writing the large blob payload.
// - There is currently no way to ask for a credential deletion (user does it manually).
//   In the future, use PublicKeyCredential.signalAllAcceptedCredentials()
//   https://www.w3.org/TR/webauthn-3/#sctn-terminology:~:text=NOTE%3A%20Authenticators%20might%20not%20be%20attached%20at%20the%20time%20signalAllAcceptedCredentials(options)%20is%20executed.%20Therefore%2C%20WebAuthn%20Relying%20Parties%20may%20choose%20to%20run%20signalAllAcceptedCredentials(options)%20periodically%2C%20e.g.%20on%20every%20sign%20in.
// - The only current way to update name/displayName (e.g.: when nostr profile changes)
//   is to upsert the credential by calling credentials.create() with the same
//   publicKey.user.id, which we won't because it could confuse the user with
//   unexpected pop-ups. It is up to the user to manually update it. In the future,
//   use PublicKeyCredential.signalCurrentUserDetails()
//   https://www.w3.org/TR/webauthn-3/#sctn-terminology:~:text=NOTE%3A%20Authenticators%20might%20not%20be%20attached%20at%20the%20time%20signalCurrentUserDetails(options)%20is%20executed.%20Therefore%2C%20WebAuthn%20Relying%20Parties%20may%20choose%20to%20run%20signalCurrentUserDetails(options)%20periodically%2C%20e.g.%20on%20every%20sign%20in.

const PASSKEY_PRF_SALT = '44b-vault'
const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()
const PASSKEY_PRF_SALT_BYTES = textEncoder.encode(PASSKEY_PRF_SALT)
const DEFAULT_CREATE_HINTS = ['client-device'] // hint we don't want external devices
const DEFAULT_GET_HINTS = [
  'client-device', // local device
  'hybrid' // e.g: external mobile phone (not USB/NFC security key)
]
// just locally created passkey because even when we add
// an account from an external device's passkey, we create
// a corresponding passkey locally
const DEFAULT_TRANSPORTS = [
  'internal' // locally created passkeys
]
const PASSKEY_LARGE_BLOB_MISSING_CODE = 'passkey-largeblob-missing'

function toHex (value) {
  if (!value) return ''
  return typeof value === 'string' ? value : bytesToHex(value)
}

function bufferSourceToUint8Array (value) {
  if (!value) return null
  if (value instanceof Uint8Array) return new Uint8Array(value)
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  if (Array.isArray(value)) return new Uint8Array(value)
  return null
}

function extractExtensions (credential) {
  return credential?.getClientExtensionResults?.() ?? {}
}

function extractPrfBytes (extensions) {
  return bufferSourceToUint8Array(extensions?.prf?.results?.first)
}

function extractLargeBlobBytes (extensions) {
  const blob = extensions?.largeBlob?.blob
  const bytes = bufferSourceToUint8Array(blob)
  return bytes && bytes.length ? bytes : null
}

function createAllowCredentialDescriptor (rawId) {
  const id = bufferSourceToUint8Array(rawId)
  if (!id) return null
  return {
    id,
    type: 'public-key',
    transports: DEFAULT_TRANSPORTS
  }
}

function base64UrlEncode (value) {
  const bytes = bufferSourceToUint8Array(value)
  if (!bytes) return ''
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function writePasskeyLargeBlob (rawId, ciphertext) {
  const descriptor = createAllowCredentialDescriptor(rawId)
  if (!descriptor) throw new Error('invalid-passkey')
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [descriptor],
      // try to not ask for OS password nor biometric/PIN support this second time
      userVerification: 'discouraged'
    },
    extensions: {
      largeBlob: {
        write: textEncoder.encode(ciphertext)
      }
    }
  })
  const extensions = credential?.getClientExtensionResults?.() ?? {}
  if (!extensions.largeBlob?.written) {
    throw new Error('passkey-largeblob-write-failed')
  }
}

async function storeAccountPrivkeyInSecureElement ({ privkey, displayName }) {
  displayName = displayName?.trim?.() ?? ''

  const derivedPubkey = getPublicKey(privkey)
  const pubkeyHex = toHex(derivedPubkey)
  const npub = npubEncode(pubkeyHex)
  // Some implementations only show user.name
  // and npub alone isn't very friendly
  const name = displayName ? `${displayName} (${npub})` : npub

  const publicKeyCredentialCreationOptions = {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    rp: {
      id: window.location.hostname,
      name: t({ key: 'vaultName' })
    },
    user: {
      id: hexToBytes(pubkeyHex),
      name,
      displayName
    },
    pubKeyCredParams: [
      { alg: -8, type: 'public-key' },
      { alg: -7, type: 'public-key' },
      { alg: -257, type: 'public-key' }
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // Don't prompt for USB/NFC security key nor other external devices
      residentKey: 'required', // person can select an user from a list of passkeys
      userVerification: 'discouraged' // it was 'preferred' but now set to 'discouraged' to try avoiding extra prompts when calling writePasskeyLargeBlob
    },
    hints: DEFAULT_CREATE_HINTS,
    extensions: {
      prf: {
        eval: { first: PASSKEY_PRF_SALT_BYTES }
      },
      largeBlob: {
        support: 'preferred'
      }
    }
  }

  const credential = await navigator.credentials.create({ publicKey: publicKeyCredentialCreationOptions })
  if (!credential) throw new Error(t({ key: 'passkeyStoreFailed' }))
  if (credential.authenticatorAttachment !== 'platform') {
    throw new Error('Another device was used')
  }

  const extensions = extractExtensions(credential)
  const prfBytes = extractPrfBytes(extensions)
  if (!prfBytes?.length) throw new Error(t({ key: 'passkeyStoreFailed' }))

  const deterministicPrivkey = generatePrivateKey({ seedBytes: prfBytes })
  const signer = NostrSigner.getOrCreate(deterministicPrivkey, { cache: false })

  let ciphertext
  try {
    ciphertext = signer.nip44Encrypt(signer.getPublicKey(), privkey)
  } finally {
    signer.cleanup?.()
  }

  const passkeyRawId = new Uint8Array(credential.rawId)

  try {
    await writePasskeyLargeBlob(passkeyRawId, ciphertext)
  } catch (_err) {
    throw new Error(t({ key: 'passkeyStoreFailed' }))
  }

  return { passkeyRawId }
}

// User will pick which session because of residentKey=required when creating passkey
// and allowCredentials=[] here
async function getPrivkeyFromSecureElement () {
  const publicKeyCredentialRequestOptions = {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    rpId: window.location.hostname,
    allowCredentials: [],
    userVerification: 'required', // e.g: ask for OS password if no biometric/PIN support
    hints: DEFAULT_GET_HINTS
  }

  const credential = await navigator.credentials.get({
    publicKey: publicKeyCredentialRequestOptions,
    extensions: {
      prf: {
        eval: { first: PASSKEY_PRF_SALT_BYTES }
      },
      largeBlob: { read: true }
    }
  })

  if (!credential) throw new Error(t({ key: 'accountLoadError' }))

  const extensions = extractExtensions(credential)
  const prfBytes = extractPrfBytes(extensions)
  if (!prfBytes?.length) throw new Error(t({ key: 'accountLoadError' }))

  const blobBytes = extractLargeBlobBytes(extensions)
  if (!blobBytes) {
    const err = new Error(t({ key: 'passkeyLargeBlobMissing' }))
    err.code = PASSKEY_LARGE_BLOB_MISSING_CODE
    throw err
  }

  const deterministicPrivkey = generatePrivateKey({ seedBytes: prfBytes })
  const signer = NostrSigner.getOrCreate(deterministicPrivkey, { cache: false })

  let privkey
  try {
    privkey = signer.nip44Decrypt(signer.getPublicKey(), textDecoder.decode(blobBytes))
  } finally {
    signer.cleanup?.()
  }

  const storedUserHandle = bufferSourceToUint8Array(credential.response.userHandle)
  const storedPubkeyHex = toHex(storedUserHandle)
  const derivedPubkeyHex = toHex(getPublicKey(privkey))
  if (storedPubkeyHex && derivedPubkeyHex && storedPubkeyHex !== derivedPubkeyHex) {
    throw new Error(t({ key: 'accountLoadError' }))
  }

  // If used an external device, clone passkey on the local device
  if (credential.authenticatorAttachment !== 'platform') {
    const profile = await getProfile(derivedPubkeyHex)
    const clonedDisplayName = profile?.name || ''
    await storeAccountPrivkeyInSecureElement({ privkey, displayName: clonedDisplayName })
  }

  return { passkeyRawId: new Uint8Array(credential.rawId), privkey }
}

// Do this to confirm a sensitive operation
async function reauthenticateWithPasskey (pubkey, rawId) {
  if (!pubkey || !rawId) {
    return { success: false, privkey: null, rawPrivkey: null }
  }

  const descriptor = createAllowCredentialDescriptor(rawId)
  if (!descriptor) return { success: false, privkey: null, rawPrivkey: null }

  const publicKeyCredentialRequestOptions = {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    rpId: window.location.hostname,
    allowCredentials: [descriptor],
    userVerification: 'required' // e.g: ask for OS password if no biometric/PIN support
  }

  const credential = await navigator.credentials.get({
    publicKey: publicKeyCredentialRequestOptions,
    mediation: 'required', // the user will always be asked to authenticate
    extensions: {
      prf: {
        eval: { first: PASSKEY_PRF_SALT_BYTES }
      },
      largeBlob: { read: true }
    }
  })

  const extensions = extractExtensions(credential)
  const prfBytes = extractPrfBytes(extensions)
  const blobBytes = extractLargeBlobBytes(extensions)
  if (!prfBytes?.length || !blobBytes) {
    return { success: false, privkey: null, rawPrivkey: null }
  }

  const deterministicPrivkey = generatePrivateKey({ seedBytes: prfBytes })
  const signer = NostrSigner.getOrCreate(deterministicPrivkey, { cache: false })

  let privkey
  try {
    privkey = signer.nip44Decrypt(signer.getPublicKey(), textDecoder.decode(blobBytes))
  } catch (_err) {
    return { success: false, privkey: null, rawPrivkey: null }
  } finally {
    signer.cleanup?.()
  }

  const derivedPubkeyHex = toHex(getPublicKey(privkey))
  const targetPubkeyHex = toHex(pubkey)
  const success = derivedPubkeyHex === targetPubkeyHex

  return {
    success,
    privkey: success ? privkey : null,
    rawPrivkey: success ? hexToBytes(privkey) : null
  }
}

async function ensurePasskeyEncryptedBackup ({ passkeyRawId, privkey }) {
  const descriptor = createAllowCredentialDescriptor(passkeyRawId)
  if (!descriptor || !privkey) return false

  const credentialIdKey = base64UrlEncode(descriptor.id)
  if (!credentialIdKey) return false

  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: window.location.hostname,
      allowCredentials: [descriptor],
      userVerification: 'discouraged',
      hints: DEFAULT_GET_HINTS
    },
    extensions: {
      prf: {
        evalByCredential: {
          [credentialIdKey]: { first: PASSKEY_PRF_SALT_BYTES }
        },
        eval: { first: PASSKEY_PRF_SALT_BYTES }
      },
      largeBlob: { read: true }
    }
  })

  const extensions = extractExtensions(credential)
  const blobBytes = extractLargeBlobBytes(extensions)
  if (blobBytes?.length) return true

  const prfBytes = extractPrfBytes(extensions)
  if (!prfBytes?.length) return false

  const deterministicPrivkey = generatePrivateKey({ seedBytes: prfBytes })
  const signer = NostrSigner.getOrCreate(deterministicPrivkey, { cache: false })

  let ciphertext
  try {
    ciphertext = signer.nip44Encrypt(signer.getPublicKey(), privkey)
  } finally {
    signer.cleanup?.()
  }

  await writePasskeyLargeBlob(descriptor.id, ciphertext)
  return true
}

export {
  storeAccountPrivkeyInSecureElement,
  getPrivkeyFromSecureElement,
  reauthenticateWithPasskey,
  ensurePasskeyEncryptedBackup,
  PASSKEY_LARGE_BLOB_MISSING_CODE
}
