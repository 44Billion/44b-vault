import idb from 'idb'
import NostrSigner from 'nostr-signer'
import { getPublicKey } from 'nostr'
import { t } from 'translator'
let sessionChannel

export function initSession () {
  sessionChannel = new BroadcastChannel('session')
  // when user clicks on another tab
  sessionChannel.addEventListener('message', e => {
    switch (e.data.code) {
      case 'LOGOUT_SESSION_ACCOUNT': { // user clicks logout btn for one account
        logoutSessionAccountHandler(e.data)
        break
      }
      case 'LOGOUT_SESSION_ACCOUNTS': { // user clicks logout btn for all accounts
        logoutSessionAccountsHandler()
        break
      }
      case 'LOCK_SESSION': { // user clicks lock btn
        lockSessionHandler()
        break
      }
      case 'UNLOCK_SESSION': { // user clicks unlock btn
        unlockSessionHandler()
        break
      }
      default: {
        throw new Error(`${e.data.code} is an unknown broadcasted message code`)
      }
    }
  })

  return _initSession()
}

async function _initSession () {
  const session = await idb.getCurrentOrNewSession()

  if (session) unlockSessionHandler()
  else lockSessionHandler()
}

async function lockScreenOrStartNewSession () {
  if (await idb.hasOnceLockedSessions()) lockSessionHandler()
  else await idb.getCurrentOrNewSession()
}

function logoutSessionAccountHandler ({ pubkey }) {
  if (!pubkey) throw new Error('LOGOUT_ACCOUNT needs pubkey')
  NostrSigner.cleanup(pubkey)
}
export async function logoutSessionAccount (pubkey) {
  logoutSessionAccountHandler({ pubkey })
  sessionChannel.postMessage({ code: 'LOGOUT_SESSION_ACCOUNT' })
  if (/* no session accs left */ !await idb.hasOnceLockedSessions()) return lockScreenOrStartNewSession()
}

function logoutSessionAccountsHandler () {
  NostrSigner.cleanupAll()
}
export async function logoutSessionAccounts () {
  logoutSessionAccountsHandler()
  sessionChannel.postMessage({ code: 'LOGOUT_SESSION_ACCOUNTS' })
  if (/* no session accs left */ !await idb.hasOnceLockedSessions()) return lockScreenOrStartNewSession()
}

function lockSessionHandler () {
  document.getElementById('screen-lock').classList.remove('invisible')
  NostrSigner.cleanupAll()
}
export function lockSession () {
  lockSessionHandler()
  sessionChannel.postMessage({ code: 'LOCK_SESSION' })
}

async function unlockSessionHandlerForTabThatStartedAction ({ sessionPrivkey }) {
  if (!sessionPrivkey) return
  try {
    const sessionPubkey = getPublicKey(sessionPrivkey)
    const idbSession = await idb.getSessionByPubkey(sessionPubkey)
    if (idbSession) {
      await idb.setCurrentSession(sessionPubkey, sessionPrivkey) // add privkey to idb
    } else { throw new Error() }
  } catch (_err) {
    throw new Error(t({ key: 'sessionKeyDoesntExistError' }))
  }
}
function unlockSessionHandler () {
  document.getElementById('screen-lock').classList.add('invisible')
}
export async function unlockSession (sessionPrivkey) {
  await unlockSessionHandlerForTabThatStartedAction({ sessionPrivkey })
  unlockSessionHandler()
  sessionChannel.postMessage({ code: 'UNLOCK_SESSION' })
}
