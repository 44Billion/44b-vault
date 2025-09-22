import idb from 'idb'

;(function keepLastMemoedNostrSigners () {
  setTimeout(() => {
    Object.keys(NostrSigner.nostrSignersByPubkey).reverse().slice(2)
      .forEach(v => { NostrSigner.nostrSignersByPubkey[v].cleanup() })
    keepLastMemoedNostrSigners()
  }, 60000)
})()

export default class NostrSigner {
  static nostrSignersByPubkey = {}

  constructor (privkey) {
    Object.assign(this, {
      privkey
    })
    this.scheduleResultGc()
    this.scheduleConversationKeyGc()
  }

  static cleanupAll () {
    this.nostrSignersByPubkey = {}
  }

  static cleanup (pubkey) {
    const signer = this.nostrSignersByPubkey[pubkey]
    signer.resultsByReqId = {}
    signer.conversationKeys = {}
    clearTimeout(signer.resultGcTimeout)
    clearTimeout(signer.conversationKeyGcTimeout)
    delete this.nostrSignersByPubkey[pubkey]
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

  resultsByReqId = { /* [id]: result */ }
  scheduleResultGc () {
    this.resultGcTimeout = setTimeout(() => {
      Object.keys(this.resultsByReqId).reverse().slice(20)
        .forEach(v => delete this.resultsByReqId[v])
      this.scheduleGc()
    }, 60000)
  }

  get_public_key () {
    return Promise.resolve(this.pubkey)
  }

  sign_event () {

  }

  get_relays ({ kind, content, tags, created_at }) {
    return Promise.resolve({})
  }

  nip04_encrypt (peerPubkey, plaintext) {

  }

  nip04_decrypt (peerPubkey, ciphertext) {

  }


  conversationKeys = { /* [pk + peerPk + salt]: ck */ }
  scheduleConversationKeyGc () {
    this.conversationKeyGcTimeout = setTimeout(() => {
      Object.keys(this.conversationKeys).reverse().slice(10)
        .forEach(v => delete this.conversationKeys[v])
      this.scheduleGc()
    }, 60000)
  }
  nip44_encrypt (peerPubkey, plaintext, salt) {
    salt ??= 'nip44-v2'

  }

  nip44_decrypt (peerPubkey, ciphertext, salt) {
    salt ??= 'nip44-v2'

  }
}
