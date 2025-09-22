import idb from 'idb'
import { getPublicKey, finalizeEvent, nip44, nip04 } from 'nostr'

// Capture stable references to avoid post-load monkey-patching
const nip44GetConversationKey = nip44.getConversationKey.bind(nip44)
const nip44Encrypt = nip44.encrypt.bind(nip44)
const nip44Decrypt = nip44.decrypt.bind(nip44)
const nip04Encrypt = nip04.encrypt.bind(nip04)
const nip04Decrypt = nip04.decrypt.bind(nip04)

;(function keepLastMemoedNostrSigners () {
  setTimeout(() => {
    Object.keys(NostrSigner.nostrSignersByPubkey).reverse().slice(2)
      .forEach(v => { NostrSigner.nostrSignersByPubkey[v].cleanup() })
    keepLastMemoedNostrSigners()
  }, 60000)
})()

// Isolated from class prototype
const privateKeys = new WeakMap()

export default class NostrSigner {
  static nostrSignersByPubkey = {}
  #_pubkey
  #resultGcTimeout
  #conversationKeyGcTimeout
  #resultsByReqId = {}
  #conversationKeys = {}

  constructor (privkey) {
    privateKeys.set(this, privkey)
    this.#_pubkey = getPublicKey(privkey)
    // Prevents signer.leak = () => this.#privkey
    Object.preventExtensions(this)
    this.scheduleResultGc()
    this.scheduleConversationKeyGc()
  }

  get #privkey () { return privateKeys.get(this) }
  get #pubkey () { return this.#_pubkey }

  static cleanupAll () {
    this.nostrSignersByPubkey = {}
  }

  static cleanup (pubkey) {
    const signer = this.nostrSignersByPubkey[pubkey]
    if (signer && typeof signer.cleanup === 'function') signer.cleanup()
    delete this.nostrSignersByPubkey[pubkey]
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

  scheduleResultGc () {
    this.#resultGcTimeout = setTimeout(() => {
      Object.keys(this.#resultsByReqId).reverse().slice(20)
        .forEach(v => delete this.#resultsByReqId[v])
      this.scheduleGc()
    }, 60000)
  }

  get_public_key () {
    return Promise.resolve(this.#pubkey)
  }

  sign_event () {
    return finalizeEvent(event, this.#privkey)
  }

  get_relays () {
    return Promise.resolve({ read: [], write: [] })
  }

  nip04_encrypt (peerPubkey, plaintext) {
    return nip04Encrypt(this.#privkey, peerPubkey, plaintext)
  }

  nip04_decrypt (peerPubkey, ciphertext) {
    return nip04Decrypt(this.#privkey, peerPubkey, ciphertext)
  }

  scheduleConversationKeyGc () {
    this.#conversationKeyGcTimeout = setTimeout(() => {
      Object.keys(this.#conversationKeys).reverse().slice(10)
        .forEach(v => delete this.#conversationKeys[v])
      this.scheduleGc()
    }, 60000)
  }
  nip44_encrypt (peerPubkey, plaintext, salt) {
    salt ??= 'nip44-v2'
    const cacheKey = `${this.#pubkey}+${peerPubkey}+${salt}`
    const ck = this.#conversationKeys[cacheKey] ??=
      nip44GetConversationKey(this.#privkey, peerPubkey, salt)
    return nip44Encrypt(plaintext, ck)
  }

  nip44_decrypt (peerPubkey, ciphertext, salt) {
    salt ??= 'nip44-v2'
    const cacheKey = `${this.#pubkey}+${peerPubkey}+${salt}`
    const ck = this.#conversationKeys[cacheKey] ??=
      nip44GetConversationKey(this.#privkey, peerPubkey, salt)
    return nip44Decrypt(ciphertext, ck)
  }
}

// Prevent prototype/constructor tampering and method injection
Object.freeze(NostrSigner.prototype)
Object.freeze(NostrSigner)
