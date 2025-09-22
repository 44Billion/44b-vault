import { config } from 'config'
import { typeof2, toAllCaps } from 'helpers'
import { translateTo, t } from 'translator'
import idb from 'idb'
import NostrSigner from 'nostr-signer'

export function initMessanger () {
  window.addEventListener('message', async e => {
    if (
      (!config.isDev && e.origin !== 'https://44billion.net') ||
      ['code', 'payload'].some(v => !(v in e.data)) ||
      typeof2(e.data.payload) !== 'object'
    ) return
    const { reqId } = e.data.payload
    let resPayload
    if (typeof2(reqId) !== 'string') {
      const key = 'reqIdTypeError'
      resPayload = { reqId, error: t({ key }), code: toAllCaps(key) }
    }

    if (!resPayload) {
      switch (e.data.code) {
        case 'TRANSLATE': {
          try {
            translateTo(e.data.payload.lang)
            resPayload = { reqId, result: true }
          } catch (err) {
            resPayload = { reqId, error: err.message }
          }
          break
        }
        case 'NOSTR_SIGN': {
          // TODO: fail at NostrSigner if no current session
          const { reqId, pubkey, method, params, app = e.origin } = e.data.payload
          resPayload = await NostrSigner.run({ reqId, pubkey, method, params })
          idb.appendLog({
            origin: e.origin, // iframe parent
            app, // may be delegating
            status: resPayload.error ? 'failure' : 'success',
            ts: Math.floor(Date.now() / 1000),
            pubkey,
            method,
            params,
            ...(resPayload.error && { message: resPayload.error, code: 'ERROR' })
          })
          break
        }
        default: {
          const key = 'unknownMessageCodeError'
          resPayload = { reqId, error: t({ key }), code: toAllCaps(key) }
        }
      }
    }

    window.parent.postMessage({
      code: e.data.code,
      payload: resPayload // { reqId: str, ?result, ?error: str }
    }, e.origin)
  })
}

let reqId = 0
// on view height change
export function changeDimensions (dimensions /* { height } */) {
  window.parent.postMessage({
    code: 'CHANGE_DIMENSIONS',
    payload: {
      reqId: String(++reqId),
      ...dimensions
    }
  })
}
// on selecting an account (or none) due to logging out (clearing acc data)
export function setPubkey (pubkey = null) {
  window.parent.postMessage({
    code: 'SET_PUBKEY',
    payload: {
      reqId: String(++reqId),
      pubkey
    }
  })
}
