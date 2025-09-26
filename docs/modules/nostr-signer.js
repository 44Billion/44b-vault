import idb from 'idb'
import { getPublicKey, finalizeEvent, nip44, nip04 } from 'nostr'
import { hexToBytes } from 'helpers/misc.js'

// Capture stable references to avoid post-load monkey-patching
const nip44GetConversationKey = nip44.getConversationKey.bind(nip44)
const nip44Encrypt = nip44.encrypt.bind(nip44)
const nip44Decrypt = nip44.decrypt.bind(nip44)
const nip04Encrypt = nip04.encrypt.bind(nip04)
const nip04Decrypt = nip04.decrypt.bind(nip04)

// TODO: clear only those not used recently
// ;(function keepLastMemoedNostrSigners () {
//   setTimeout(() => {
//     Object.keys(NostrSigner.#nostrSignersByPubkey).reverse().slice(2)
//       .forEach(v => { NostrSigner.#nostrSignersByPubkey[v].cleanup() })
//     keepLastMemoedNostrSigners()
//   }, 60000)
// })()

// Isolated from class prototype
const privateKeys = new WeakMap()
const createToken = Symbol('createToken')

export default class NostrSigner {
  static #nostrSignersByPubkey = {}
  #_pubkey
  #resultGcTimeout
  #conversationKeyGcTimeout
  #resultsByReqId = {}
  #conversationKeys = {}

  // Get the list of logged-in pubkeys
  static get loggedInPubkeys () {
    return Object.keys(this.#nostrSignersByPubkey)
  }

  // Check if any user is signed in
  static get hasLoggedInUsers () {
    return this.loggedInPubkeys.length > 0
  }

  // This also caches the privkey on memory
  // to avoid asking user to unlock with passkey
  // the next time we need to sign/encrypt things
  static getOrCreate (privkey) {
    if (!privkey) throw new Error('Missing privkey arg.')
    return (this.#nostrSignersByPubkey[getPublicKey(privkey)] ??= new this(createToken, privkey))
  }

  constructor (token, privkey) {
    if (token !== createToken) throw new Error('Use NostrSigner.create(?sk) to instantiate this class.')

    privateKeys.set(this, hexToBytes(privkey))
    // Prevents signer.leak = () => this.#privkey
    Object.preventExtensions(this)
    this.#scheduleResultGc()
    this.#scheduleConversationKeyGc()
  }
  // bytes
  get #privkey () { return privateKeys.get(this) }
  // hex
  get #pubkey () { return (this.#_pubkey ??= getPublicKey(this.#privkey)) }

  static cleanupAll () {
    this.#nostrSignersByPubkey = {}
  }

  static revoke (signer) {
    if (!(signer instanceof NostrSigner)) throw new Error('Expected instance of NostrSigner')
    this.cleanup(signer.#pubkey)
  }

  static cleanup (pubkey) {
    const signer = this.#nostrSignersByPubkey[pubkey]
    if (signer && typeof signer.cleanup === 'function') signer.cleanup()
    delete this.#nostrSignersByPubkey[pubkey]
  }

  cleanup () {
    this.#resultsByReqId = {}
    this.#conversationKeys = {}
    clearTimeout(this.#resultGcTimeout)
    clearTimeout(this.#conversationKeyGcTimeout)
  }

  static async run ({ reqId, pubkey, method, params }) {
    try {
      // pubkey ??= await idb.getPubkey()
      // if (!pubkey) {
      //   pubkey = await idbGetLastUsedPubkey()
      //   // select account for apps that rely on signer to tell the logged in user
      //   // by asking with method=getPublicKey
      //   await idbSetPubkey(pubkey)
      // }

      const signer = this.nostrSigners[pubkey] ??= (async () => {
        // decrypt account's privkey using selected session's privkey, or fail
        const privkey = await idb.getPrivateKey(pubkey)
        return new this(privkey)
      })()
      // const signer = this.nostrSigners[pubkey] ??= (async () => {
      //   const privkey = tempKeypair[pubkey] || await idb.getPrivkey(pubkey)
      //   return new this(privkey)
      // })()
      // return {
      //   reqId,
      //   result: signer.resultsByReqId[reqId] ??= await signer[method](...params)
      // }
    } catch (error) {
      return {
        reqId,
        error: error.message
      }
    }
  }

  #scheduleResultGc () {
    this.#resultGcTimeout = setTimeout(() => {
      Object.keys(this.#resultsByReqId).reverse().slice(20)
        .forEach(v => delete this.#resultsByReqId[v])
      this.#scheduleResultGc()
    }, 60000)
  }

  getPublicKey () {
    return this.#pubkey
  }

  signEvent (event) {
    return finalizeEvent(event, this.#privkey)
  }

  getRelays () {
    return { read: [], write: [] }
  }

  nip04Encrypt (peerPubkey, plaintext) {
    return nip04Encrypt(this.#privkey, hexToBytes(peerPubkey), plaintext)
  }

  nip04Decrypt (peerPubkey, ciphertext) {
    return nip04Decrypt(this.#privkey, hexToBytes(peerPubkey), ciphertext)
  }

  #scheduleConversationKeyGc () {
    this.#conversationKeyGcTimeout = setTimeout(() => {
      Object.keys(this.#conversationKeys).reverse().slice(10)
        .forEach(v => delete this.#conversationKeys[v])
      this.#scheduleConversationKeyGc()
    }, 60000)
  }
  nip44Encrypt (peerPubkey, plaintext, salt) {
    salt ??= 'nip44-v2'
    const cacheKey = `${this.#pubkey}+${peerPubkey}+${salt}`
    const ck = this.#conversationKeys[cacheKey] ??=
      nip44GetConversationKey(this.#privkey, hexToBytes(peerPubkey), salt)
    return nip44Encrypt(plaintext, ck)
  }

  nip44Decrypt (peerPubkey, ciphertext, salt) {
    salt ??= 'nip44-v2'
    const cacheKey = `${this.#pubkey}+${peerPubkey}+${salt}`
    const ck = this.#conversationKeys[cacheKey] ??=
      nip44GetConversationKey(this.#privkey, hexToBytes(peerPubkey), salt)
    return nip44Decrypt(ciphertext, ck)
  }
}

// Prevent prototype/constructor tampering and method injection
Object.freeze(NostrSigner.prototype)
Object.freeze(NostrSigner)
