const MIN_KEY = -Infinity
const MAX_KEY = [[]]
const idb = {
  minKey: MIN_KEY,
  maxKey: MAX_KEY
}
let db
async function initDb (...args) {
  return (db ??= await _initDb(...args).then(db => {
    Object.assign(idb, { db })
    return db
  }))
}
function _initDb (dbName = '44b-vault', dbVersion = 2) {
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
        appId, // delegator app, informed by delegatee
        // de-normalized for now
        app: {
          id, // +[+][+]..., tlv without relay hints, from +<fullAppId>
          alias,
          name,
          icon: { fx, url }
        },
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
        appId, // +[+][+]..., tlv without relay hints, from +<fullAppId>
        name, // e.g.: 'decryption|signing|new-permission-example|...'
        eKind, // e.g.: '<0|1|10002|...|-1 means "all kinds">'
        ts
      }
      */
      // NOTE: keyPath order is ['appId','name','eKind'] (name before eKind) so we can
      // efficiently range-query both the specific kind and the wildcard (-1) in a single
      // request: IDBKeyRange.bound([appId,name,-1],[appId,name,targetKind])
      db.createObjectStore('permissions', { keyPath: ['appId', 'name', 'eKind'] })
      /*
      {
        id, // +[+][+]..., from +<fullAppId>
        alias, // +[+][+]abc@44billion.net, i.e. from +<appIdAlias>[@<domain>]
        name, // from bundleMetadata event
        icon: { fx, url }, // from bundle event
        ts
      }
      */
      db.createObjectStore('apps', { keyPath: 'id' })
    }
    if (e.oldVersion < 2) {
      const storeName = 'queueEntries'
      const existingStores = Array.from(db.objectStoreNames)
      const hasQueueStore = existingStores.includes(storeName)
      const queueStore = hasQueueStore
        ? req.transaction.objectStore(storeName)
        : db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true })

      if (!queueStore.indexNames.contains('type')) {
        queueStore.createIndex('type', 'type', { unique: false })
      }
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

function toUint8Array (value) {
  if (!value) return null
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  return null
}

function areUint8ArraysEqual (a, b) {
  const left = toUint8Array(a)
  const right = toUint8Array(b)
  if (!left || !right || left.length !== right.length) return false
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false
  }
  return true
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

async function enqueueQueueEntry (record) {
  if (!record || typeof record.type !== 'string') throw new Error('type is required')
  const payload = {
    ...record,
    enqueuedAt: record.enqueuedAt ?? Date.now(),
    retryCount: record.retryCount ?? 0,
    lastAttemptAt: record.lastAttemptAt ?? null,
    lastError: record.lastError ?? null
  }
  return run('add', [payload], 'queueEntries').then(() => undefined)
}

async function deleteQueueEntryById (id) {
  if (id == null) throw new Error('id is required')
  return run('delete', [id], 'queueEntries').then(() => undefined)
}

async function * iterateQueueEntries ({ type } = {}) {
  let lastPrimaryKey = null

  while (true) {
    let record
    try {
      record = await readNextQueueEntry({ type, lastPrimaryKey })
    } catch (err) {
      if (err?.name === 'TransactionInactiveError') {
        continue
      }
      throw err
    }

    const { entry, primaryKey } = record || {}
    if (!entry) break

    lastPrimaryKey = primaryKey ?? entry.id ?? lastPrimaryKey
    yield entry
  }
}

async function readNextQueueEntry ({ type, lastPrimaryKey }) {
  const db = await _initDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['queueEntries'], 'readonly')
    const store = tx.objectStore('queueEntries')
    const source = type ? store.index('type') : store

    let request
    if (type) {
      request = source.openCursor(IDBKeyRange.only(type))
    } else {
      const range = lastPrimaryKey != null ? IDBKeyRange.lowerBound(lastPrimaryKey, true) : undefined
      request = range ? source.openCursor(range) : source.openCursor()
    }

    request.onsuccess = () => handleCursor(request.result)
    request.onerror = () => reject(request.error)

    function handleCursor (cursor) {
      if (!cursor) {
        resolve({ entry: null })
        return
      }

      if (type && lastPrimaryKey != null && cursor.primaryKey <= lastPrimaryKey) {
        try {
          if (typeof cursor.continuePrimaryKey === 'function') {
            cursor.continuePrimaryKey(type, lastPrimaryKey)
          } else {
            cursor.continue()
          }
        } catch (err) {
          reject(err)
        }
        return
      }

      const value = { ...cursor.value }
      if (value.id == null) value.id = cursor.primaryKey
      resolve({ entry: value, primaryKey: cursor.primaryKey })
    }
  })
}

async function updateQueueEntryById (id, updates) {
  if (id == null) throw new Error('id is required')

  const { result: existing } = await run('get', [id], 'queueEntries')
  if (!existing) return false

  const nextValue = typeof updates === 'function' ? updates(existing) : { ...existing, ...updates }
  if (!nextValue) return false

  const payload = {
    ...nextValue,
    id: existing.id ?? id
  }

  await run('put', [payload], 'queueEntries')
  return true
}

async function getQueueEntries ({ type } = {}) {
  const entries = []
  for await (const entry of iterateQueueEntries({ type })) entries.push(entry)
  return entries
}

async function getAccountByPubkey (pubkey) {
  return run('get', [pubkey], 'accounts').then(v => v.result)
}

async function getAccountByPasskeyRawId (rawId) {
  const target = toUint8Array(rawId)
  if (!target) return null
  const accounts = await getAllAccounts()
  return accounts.find(account => areUint8ArraysEqual(account?.passkeyRawId, target)) ?? null
}

async function getAllAccounts () {
  return run('getAll', [], 'accounts').then(v => v.result)
}

async function deleteAccountByPubkey (pubkey) {
  if (!pubkey) throw new Error('pubkey is required')
  return run('delete', [pubkey], 'accounts')
}

async function hasLoggedInUsers () {
  // Using openKeyCursor with limit 1 is more efficient than counting all records
  return run('openKeyCursor', [undefined, 'next'], 'accounts').then(v => !!v.result)
}

async function hasPermission (appId, name, eKind) {
  if (!appId || !name || eKind == null) throw new Error('appId, name and eKind are required')
  if (eKind === -1 /* wildcard */) {
    return run('get', [[appId, name, -1]], 'permissions').then(v => !!v.result)
  }

  const range = IDBKeyRange.bound([appId, name, -1], [appId, name, eKind])
  const p = Promise.withResolvers()
  run('openKeyCursor', [range], 'permissions', null, { p })

  let cursor
  let keyEKind
  const continueKey = [appId, name, eKind]
  while ((cursor = (await p.promise).result)) {
    keyEKind = cursor.primaryKey[2]
    if (keyEKind === -1 || keyEKind === eKind) return true

    Object.assign(p, Promise.withResolvers())
    cursor.continue(continueKey)
  }
  return false
}

Object.assign(idb, {
  run,
  createOrUpdateAccount,
  getAccountByPubkey,
  getAccountByPasskeyRawId,
  getAllAccounts,
  deleteAccountByPubkey,
  hasLoggedInUsers,
  hasPermission,
  appendLog,
  enqueueQueueEntry,
  deleteQueueEntryById,
  iterateQueueEntries,
  getQueueEntries,
  updateQueueEntryById
})

export default idb
export {
  initDb
}
