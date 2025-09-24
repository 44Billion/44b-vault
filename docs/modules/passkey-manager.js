import { npubEncode, getPublicKey } from 'nostr'
import { getProfile } from 'queries'
import { bytesToHex, hexToBytes } from 'helpers/misc.js'
import { t } from 'translator'

// Notes:
// - Passkeys are designed to sign a challenge to prove that a person holds a
//   pubkey, from keypair previously created at random by the device's authenticator,
//   saved on server and associated to a specific user also stored on server.
//   We instead skip the signing feature and use the authenticator as a safe
//   place to store any nostr privkeys we've created or imported.
// - In our case (fully client-side flow), an external device wouldn't make
//   it more secure because we don't use the signatures but just the user.id
//   set to the privkey, i.e., the privkey leaves the secure element upon signing in.
//   That's why we set hints=['client-device'] and
//   authenticatorSelection.authenticatorAttachment=platform on credentials.create()
// - There is currently no way to ask for a credential deletion (user does it manually)
// - The only current way to update name/displayName (e.g.: when nostr profile changes)
//   is to upsert the credential by calling credentials.create() with the same
//   publicKey.user.id, which we won't because it could confuse the user with
//   unexpected pop-ups. It is up to the user to manually update it.

async function storeAccountPrivkeyInSecureElement ({ privkey, displayName }) {
  displayName = displayName?.trim?.() ?? ''
  const npub = npubEncode(getPublicKey(privkey))
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
      id: hexToBytes(privkey),
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
      userVerification: 'preferred'
    },
    hints: ['client-device'] // hint we don't want external devices
  }
  return navigator.credentials.create({
    publicKey: publicKeyCredentialCreationOptions
  }).then(v => {
    if (v.authenticatorAttachment !== 'platform') {
      throw new Error('Another device was used')
    }
    return v
  })
}

// User will pick which session cause of residentKey=required when creating passkey
// and allowCredentials=[] here
async function getPrivkeyFromSecureElement () {
  const publicKeyCredentialRequestOptions = {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    rpId: window.location.hostname,
    allowCredentials: [],
    userVerification: 'required', // e.g: ask for OS password if no biometric/PIN support
    hints: [
      'client-device', // local device
      'hybrid' // e.g: external mobile phone (not USB/NFC security key)
    ]
  }
  const { rawId, authenticatorAttachment } = await navigator.credentials.get({
    publicKey: publicKeyCredentialRequestOptions
  })
  const privkey = bytesToHex(new Uint8Array(rawId /* ArrayBuffer */))
  // If used an external device, clone passkey on the local device
  if (authenticatorAttachment !== 'platform') {
    const pubkey = getPublicKey(privkey)
    const displayName = (await getProfile(pubkey)).name || ''
    await storeAccountPrivkeyInSecureElement({ privkey, displayName })
  }
  return privkey
}

// Do this to confirm a sensitive operation
// TODO: use at signer cause privkey is a private instance prop
async function reauthenticateWithPasskey (privkey) {
  if (!privkey) return false

  // we only know the current unlocked session key
  const publicKeyCredentialDescriptor = {
    id: hexToBytes(privkey),
    type: 'public-key',
    // just locally created passkey because even when we add
    // an account from an external device's passkey, we create
    // a corresponding passkey locally
    transports: ['internal']
  }
  const publicKeyCredentialRequestOptions = {
    // Server generated challenge:
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    rpId: window.location.hostname,
    allowCredentials: [publicKeyCredentialDescriptor],
    userVerification: 'required' // e.g: ask for OS password if no biometric/PIN support
  }
  const { rawId } = await navigator.credentials.get({
    publicKey: publicKeyCredentialRequestOptions,
    mediation: 'required' // the user will always be asked to authenticate
  })
  return privkey === bytesToHex(new Uint8Array(rawId /* ArrayBuffer */))
}

// This privkey will encrypt account privkeys on idb upon locking screen
// CAUTION: Don't call it more than once or else it will create
// a new credential each time (cause of different privkey arg)
async function storeUnlockPrivkeyInSecureElement ({ privkey }) {
  const publicKeyCredentialCreationOptions = {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    rp: {
      id: window.location.hostname,
      name: t({ key: 'vaultName' })
    },
    user: {
      // credentials.create() can upsert by user.id, but it wouldn't help us
      // because our id can't be fixed (see comment on authenticatorSelection.residentKey)
      id: hexToBytes(privkey), // Uint8Array
      name: t({ key: 'unlockPasskeyName' }),
      // This will help user keep just the most recent one
      // by manually deleting old unlock-related-passkey from his device
      displayName: new Date().toLocaleDateString()
    },
    pubKeyCredParams: [
      { alg: -8, type: 'public-key' },
      { alg: -7, type: 'public-key' },
      { alg: -257, type: 'public-key' }
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      // unfortunatelly, we can't set user.id to
      // e.g.: new TextEncoder().encode('unlock-nostr-secure-login')
      // and later limit credentials to allowCredentials: [{ id, type: 'public-key' }]
      // when unlocking screen
      // because the return.rawId/return.response.userHandle of credentials.get()
      // is the only thing returned about the user (can't access name/displayName)
      residentKey: 'required', // person can select an user from a list of passkeys
      userVerification: 'discouraged' // if possible, don't ask for pin/biometric
    },
    hints: ['client-device']
  }
  return navigator.credentials.create({
    publicKey: publicKeyCredentialCreationOptions
  }).then(v => {
    if (v.authenticatorAttachment !== 'platform') {
      throw new Error('Another device was used')
    }
    return v
  }).then(v => {
    // force asking for pin/biometrics on next credentials.get()
    navigator.credentials.preventSilentAccess()
    return v
  })
}

async function getUnlockPrivkeyFromSecureElement () {
  const publicKeyCredentialRequestOptions = {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    rpId: window.location.hostname,
    // Unfortunately we can't narrow down the passkey selection
    // to just the one meant to unlock screen
    allowCredentials: [],
    userVerification: 'required', // e.g: ask for OS password if no biometric/PIN support
    hints: ['client-device'] // unlocking just makes sense with passkey created on local device
  }
  const { rawId } = await navigator.credentials.get({
    publicKey: publicKeyCredentialRequestOptions
  })
  const unlockPrivkey = bytesToHex(new Uint8Array(rawId /* ArrayBuffer */))
  // don't forget to delete it after locking again
  // storeOnIdb() .. do this on the unlock handler? do it here to make sure we dont forget it? no YES
  return unlockPrivkey
}

export {
  storeAccountPrivkeyInSecureElement,
  getPrivkeyFromSecureElement,
  reauthenticateWithPasskey,
  storeUnlockPrivkeyInSecureElement,
  getUnlockPrivkeyFromSecureElement
}
