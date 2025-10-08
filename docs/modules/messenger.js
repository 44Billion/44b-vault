import { config } from 'config'
import { typeof2 } from 'helpers/misc.js'
import { toAllCaps } from 'helpers/string.js'
import { translateTo, t } from 'translator'
import idb from 'idb'
import NostrSigner from 'nostr-signer'

let reqId = 0
const {
  promise: browserPortPromise,
  resolve: resolveBrowserPort,
  rejectBrowserPort
} = Promise.withResolvers()

async function getAllAccounts () {
  const { loggedInPubkeys } = NostrSigner
  return (await idb.getAllAccounts()).map(({ pubkey, profile, relays }) => {
    return {
      pubkey, profile, relays,
      isLocked: !loggedInPubkeys.includes(pubkey)
    }
  })
}

export async function initMessenger () {
  const isntInIframe = window === window.top
  if (isntInIframe) {
    const portStub = {
      postMessage: msg => {
        config.isDev && console.log('[vault] Vault isn\'t in iframe, ignoring message', msg)
      }
    }
    resolveBrowserPort(portStub)
    return
  }

  const { port1: browserPort, port2: vaultPortForBrowser } = new MessageChannel()

  browserPort.addEventListener('message', e => {
    if (e.data.code !== 'BROWSER_READY') return rejectBrowserPort()
    resolveBrowserPort(browserPort)
  }, { once: true })

  async function tellBrowserImReady () {
    const readyMsg = {
      reqId: String(++reqId),
      code: 'VAULT_READY',
      payload: {
        // take the opportunity to kickstart the browser side
        accounts: await getAllAccounts()
      }
    }
    window.parent.postMessage(readyMsg, {
      targetOrigin: config.isDev ? '*' : 'https://44billion.net',
      transfer: [vaultPortForBrowser]
    })
  }

  browserPort.addEventListener('message', async e => {
    if (
      (!config.isDev && e.origin !== 'https://44billion.net') ||
      ['code', 'payload'].some(v => !(v in e.data)) ||
      typeof2(e.data.payload) !== 'object' ||
      !await browserPortPromise.catch(() => false)
    ) return

    const { reqId } = e.data
    let resData
    if (typeof2(reqId) !== 'string') {
      const key = 'reqIdTypeError'
      resData = { reqId, error: new Error(`${toAllCaps(key)}: ${t({ key })}`) }
    }

    if (!resData) {
      switch (e.data.code) {
        case 'TRANSLATE': {
          try {
            translateTo(e.data.payload.lang)
            resData = { reqId, payload: true }
          } catch (err) {
            resData = { reqId, error: err.message }
          }
          break
        }
        case 'NIP07': {
          const { pubkey, method, params, app = {}, ns = [] } = e.data.payload
          const [nsName = '', ...nsParams] = ns
          resData = await NostrSigner.run({ app, ns, pubkey, method, params })

          idb.appendLog({
            origin: e.origin, // iframe parent
            app, // may be delegating
            status: resData.error ? 'failure' : 'success',
            ts: Math.floor(Date.now() / 1000),
            ns: { name: nsName, params: nsParams },
            pubkey,
            method,
            params,
            error: resData.error
              ? {
                  message: resData.error.message,
                  code: resData.error.context.code,
                  eventKind: resData.error.context.eventKind
                }
              : {}
          })
          break
        }
        default: {
          const key = 'unknownMessageCodeError'
          resData = { error: new Error(`${toAllCaps(key)}: ${t({ key })}`) }
        }
      }
    }

    browserPort.postMessage({
      reqId: e.data.reqId,
      code: 'REPLY',
      ...resData // { ?payload, ?error }
    }, e.origin)
  })
  browserPort.start()
  await tellBrowserImReady()
  return browserPortPromise
}

// on view height change
export async function changeDimensions (dimensions /* { height } */) {
  (await browserPortPromise).postMessage({
    reqId: String(++reqId),
    code: 'CHANGE_DIMENSIONS',
    payload: {
      ...dimensions
    }
  })
}

// on adding/removing/locking account
export async function setAccountsState () {
  (await browserPortPromise).postMessage({
    reqId: String(++reqId),
    code: 'SET_ACCOUNTS_STATE',
    payload: {
      accounts: await getAllAccounts()
    }
  })
}
