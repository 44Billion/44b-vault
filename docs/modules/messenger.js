import { config } from 'config'
import { typeof2, hideSuccessOverlay, hideErrorOverlay } from 'helpers/misc.js'
import { toAllCaps } from 'helpers/string.js'
import { translateTo, t } from 'translator'
import { router } from 'router'
import idb from 'idb'
import NostrSigner from 'nostr-signer'

let reqId = 0
const {
  promise: browserPortPromise,
  resolve: resolveBrowserPort,
  rejectBrowserPort
} = Promise.withResolvers()

async function getAllAccounts () {
  const { unlockedPubkeys } = NostrSigner
  return (await idb.getAllAccounts()).map(({ pubkey, profile, relays }) => {
    return {
      pubkey, profile, relays,
      isLocked: !unlockedPubkeys.includes(pubkey)
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
    if (!await browserPortPromise.catch(() => false)) return

    const { reqId } = e.data
    let resData

    if (!resData) {
      switch (e.data.code) {
        case 'TRANSLATE': {
          try {
            translateTo(e.data.payload.lang)
            resData = { payload: true }
          } catch (err) {
            resData = { error: err.message }
          }
          break
        }
        case 'UNLOCK_ACCOUNT': {
          const { pubkey } = e.data.payload
          if (!pubkey) {
            resData = { error: new Error('Missing pubkey in UNLOCK_ACCOUNT payload') }
            break
          }

          // If 'CLOSED_VAULT_VIEW' case is fixed, revert all that below with jist
          // router.goToRoute({ route: '/unlock-account', queryParams: { userPk: pubkey } })
          requestIdleCallback(() => {
            router.goBack({ toRoot: true })
            requestIdleCallback(() => requestIdleCallback(() => {
              router.goToRoute({
                route: '/unlock-account',
                queryParams: { userPk: pubkey }
              })
            }))
          })

          // Send back a message indicating the route is ready
          resData = { payload: { isRouteReady: true } }
          break
        }
        case 'CLOSED_VAULT_VIEW': {
          // Keep it commentend for now.
          // Because of how closed html dialogs work, atleast on Firefox,
          // transitioning page while vault modal (dialog) is closed
          // will make the container height 0 at
          // docs/modules/router.js:105
          // ```
          // const nextViewHeight = document.querySelector(`#page-${page} > div:not(.invisible)`).getBoundingClientRect().height
          // ```
          //
          // We will add a generic 'OPEN_VAULT_HOME' as a workaround
          //
          // router.goBack({ toRoot: true })
          hideSuccessOverlay()
          hideErrorOverlay()
          return
        }
        // If 'CLOSED_VAULT_VIEW' case is fixed, delete this,
        // also from browser side
        case 'OPEN_VAULT_HOME': {
          router.goBack({ toRoot: true })
          return
        }
        case 'NIP07': {
          const { pubkey, method, params, app = {}, ns = [] } = e.data.payload
          const [nsName = '', ...nsParams] = ns
          resData = await NostrSigner.run({
            app: {
              ...app,
              // For now, nip07 calls are always from browser itself, not from apps
              id: null
            },
            ns, pubkey, method, params
          })

          idb.appendLog({
            origin: e.origin, // iframe parent
            appId: app.id ?? '', // may be delegating
            // maybe normalize this (debounced) to apps store
            app,
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

    if (typeof2(reqId) !== 'string') {
      const key = 'reqIdTypeError'
      resData = { error: new Error(`${toAllCaps(key)}: ${t({ key })}`) }
    }
    browserPort.postMessage({
      reqId: e.data.reqId,
      code: 'REPLY',
      ...resData // { ?payload, ?error }
    })
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

export async function closeVaultView () {
  (await browserPortPromise).postMessage({
    reqId: String(++reqId),
    code: 'CLOSE_VAULT_VIEW',
    payload: null
  })
}
