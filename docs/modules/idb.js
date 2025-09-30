import { getPublicKey, nip44 } from 'nostr'

const idb = {}
const MIN_KEY = -Infinity
const MAX_KEY = [[]]
let db
async function initDb (...args) {
  return (db ??= await _initDb(...args).then(db => {
    Object.assign(idb, { db })
    return db
  }))
}
function _initDb (dbName = 'nostr-secure-login', dbVersion = 1) {
  const req = indexedDB.open(dbName, dbVersion)
  // eslint-disable-next-line prefer-const, promise/param-names
  let resolve, reject, promise = new Promise((rs, rj) => { resolve = rs; reject = rj })

  req.onupgradeneeded = async function (e) {
    const db = req.result
    if (e.oldVersion < 1) {
      /*
      {
        pubkey,
        passkeyRawId,
        profile: {},
        relays: {},
        ts // last update
      }
      */
      db.createObjectStore('accounts', { keyPath: 'pubkey' })
      /*
      {
        id, // auto; not the request id
        origin, // iframe parent, optional
        appId, // delegator app, informed by delegatee, from +<fullAppId>
        status, // success || failure
        ts,
        pubkey,
        method,
        params,
        ?message // on failure (ex: 'NOT_PERMITTED')
      }
      */
      db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true })
      /*
      {
        appId, // from +<fullAppId>
        eKind, // e.g.: '<0|1|10002|...|empty string means "all kinds">'
        name, // e.g.: 'decryption|signing|new-permission-example|...'
        ts
      }
      */
      db.createObjectStore('permissions', { keyPath: ['appId', 'eKind', 'name'] })
      /*
      {
        id, // from +<fullAppId>
        alias, // abc@44billion.net, i.e. from +<appIdAlias>
        name, // from bundle event
        icon, // from bundle event
        ts
      }
      */
      db.createObjectStore('apps', { keyPath: 'id' })
    }
  }
  req.onerror = function () { reject(req.error) }
  req.onsuccess = function () {
    const db = req.result
    db.onversionchange = function () {
      db.close()
      location.reload(true)
    }
    db.onerror = function () { console.log(`IndexedDB error. Code: ${req.errorCode} - ${req.error.stack}`) }
    resolve(db)
  }

  return promise
}

async function run (method, args = [], storeName, indexName, { p = Promise.withResolvers(), tx, txMode = tx?.mode, storeOrIndex } = {}) {
  if (!tx) {
    const db = await _initDb()
    // one may pre-select it if it wants to use many different methods in a row
    txMode ??= ['get', 'getKey', 'count'].includes(method) ? 'readonly' : 'readwrite'
    tx = db.transaction([storeName], txMode)
  }
  if (!storeOrIndex) {
    const store = tx.objectStore(storeName)
    storeOrIndex = indexName ? store.index(indexName) : store
  }

  const req = storeOrIndex[method](...args)
  req.onsuccess = () => { p.resolve({ result: req.result, tx, storeOrIndex }) } // don't add p
  req.onerror = () => { p.reject(req.error); tx.abort() }
  return p.promise
}

async function updatePendingCurrentSessionAssociations (currentSession) {
  currentSession ??= await idb.getCurrentSession()
  if (
    // never locked current session (no privkey) won't have 'sessions' store association
    !currentSession?.privkey ||
    // we currently don't care about which dirty fields
    // !(dirtyFields = currentSession.pendingAssociationUpdateFields)
    !currentSession.pendingAssociationUpdateFields
  ) return

  const sessionPubkey = getPublicKey(currentSession.privkey)
  const session = await run('get', [sessionPubkey], 'session').then(v => v.result)
  if (!session) throw new Error('Should had created session (when locking for the first time) before calling updatePendingCurrentSessionAssociations')

  const ck = await nip44.getConversationKey(currentSession.privkey, session.pubkey)
  session.eAccountPubkeys = await nip44.encrypt(
    JSON.stringify(currentSession.accountPubkeys || {}),
    ck
  )

  await updatedSession(session)
  delete currentSession.pendingAssociationUpdateFields
  return updatedCurrentSession(currentSession)
}
async function updatedSession (session) {
  return run('put', [session], 'sessions')
}
async function updatedCurrentSession (currentSession) {
  return run('put', [currentSession], 'current-session')
}
// sessions never locked won't be persisted on sessions store
async function hasOnceLockedSessions () {
  return !!await run('getKey', [IDBKeyRange.bound(MIN_KEY, MAX_KEY)], 'sessions').then(v => v.result)
}
async function hasCurrentSessionEverBeenLocked () {
  return !!(await getCurrentSession()).privkey
}
async function getCurrentSession () {
  return run('get', [IDBKeyRange.bound(MIN_KEY, MAX_KEY)], 'current-session').then(v => v.result)
}
async function startFreshSession () {
  const currentSession = {
    accountPubkeys: {}
  }
  await run('put', [currentSession], 'current-session')
  return currentSession
}
async function getCurrentOrNewSession () {
  const currentSession = await getCurrentSession()
  if (currentSession) {
    await updatePendingCurrentSessionAssociations(currentSession)
    return currentSession
  } else {
    if (await hasOnceLockedSessions()) return
    return startFreshSession()
  }
}

async function appendLog (log) {
  // eslint-disable-next-line prefer-const, promise/param-names
  let resolve, reject, promise = new Promise((rs, rj) => { resolve = rs; reject = rj })
  const db = await _initDb()
  const tx = db.transaction(['logs'], 'readwrite')
  const store = tx.objectStore('logs')
  const req = store.add(log)
  req.onsuccess = () => { resolve() }
  req.onerror = ({ error }) => { reject(error) }
  return promise
}

async function trimLog () {
  const maxEntries = 300
  const db = await _initDb()
  const upperBoundKey = await new Promise(resolve => {
    const tx = db.transaction(['logs'], 'readonly')
    const store = tx.objectStore('logs')
    const req = store.openKeyCursor(undefined, 'prev')
    const isFirstRun = false
    req.onsuccess = ({ result: cursor }) => {
      if (!cursor) return resolve()
      if (isFirstRun) { return cursor.advance(maxEntries - 1) }
      resolve(cursor.primaryKey)
    }
    req.onerror = () => { resolve() }
  })
  if (upperBoundKey === undefined) return

  // eslint-disable-next-line prefer-const, promise/param-names
  let resolve, reject, promise = new Promise((rs, rj) => { resolve = rs; reject = rj })
  const tx = db.transaction(['logs'], 'readwrite')
  const store = tx.objectStore('logs')
  const req = store.delete(IDBKeyRange.upperBound(upperBoundKey, true))
  req.onsuccess = () => { resolve() }
  req.onerror = ({ error }) => { reject(error) }
  return promise
}

(function scheduleTrimLog () {
  setTimeout(async () => {
    await trimLog()
    scheduleTrimLog()
  }, 60000 * 5)
})()

async function createOrUpdateAccount (account) {
  return run('put', [{ ...account, ts: Date.now() }], 'accounts')
}

async function getAccountByPubkey (pubkey) {
  return run('get', [pubkey], 'accounts').then(v => v.result)
}

async function getAllAccounts () {
  return run('getAll', [], 'accounts').then(v => v.result)
}

async function deleteAccountByPubkey (pubkey) {
  if (!pubkey) throw new Error('pubkey is required')
  return run('delete', [pubkey], 'accounts')
}

Object.assign(idb, {
  run,
  createOrUpdateAccount,
  getAccountByPubkey,
  getAllAccounts,
  deleteAccountByPubkey,
  getCurrentSession,
  getCurrentOrNewSession,
  updatedCurrentSession,
  updatedSession,
  updatePendingCurrentSessionAssociations,
  hasOnceLockedSessions,
  hasCurrentSessionEverBeenLocked,
  appendLog
})
// await idb.updatePendingCurrentSessionAssociations()
export default idb
export {
  initDb
}
