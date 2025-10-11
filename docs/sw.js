// Any change to this file will reinstall sw. Remember to update version.
const VERSION = '1'
const APP_PREFIX = '44b-vault'
const CACHE_KEY = `${APP_PREFIX}:${VERSION}`
const URLS_TO_PRECACHE = [
  './',
  './index.html',
  './modules/avatar.js',
  './modules/config.js',
  './modules/handlers/header.js',
  './modules/handlers/home.js',
  './modules/handlers/index.js',
  './modules/handlers/lock.js',
  './modules/handlers/new-account.js',
  './modules/handlers/unlock.js',
  './modules/helpers.js',
  './modules/idb.js',
  './modules/index.js',
  './modules/messenger.js',
  './modules/nostr-signer.js',
  './modules/nostr.js',
  './modules/queries.js',
  './modules/router.js',
  './modules/sw-manager.js',
  './modules/translator.js',
  './styles/global.css',
  './styles/icons.css',
  './styles/index.css',
  './styles/reset.css',
]

const swPathname = self.location.pathname.replace(/\/[^/]*$/, '')
const swPathnameRegex = new RegExp('^' + swPathname)
// Respond with cached resources
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse // responding with cache
      else {
        const shouldCache =
          e.request.method === 'GET' &&
          URLS_TO_PRECACHE.includes('.' + new URL(e.request.url).pathname.replace(swPathnameRegex, ''))
        console.log(`file is not cached, fetching ${shouldCache ? 'to cache' : ''}: ${e.request.url}`)
        return fetch(e.request, { headers: { 'Cache-Control': 'no-cache' /* bypass Github Pages 10min cache */}}).then(response => {
          if (shouldCache) caches.open(CACHE_KEY).then(cache => cache.add(e.request, response))
          return response
        })
      }
    })
  )
})

// Cache resources
// Do not call self.skipWaiting() because some of page's fetches will have been handled
// by old service worker, but new service worker would handle subsequent fetches leading to bugs
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_KEY).then(async cache => {
      try {
        self.addEventListener('fetch', () => {})
      } catch (err) {
        console.log('errrr', err)
      }
      // console.log('test api', test)
      console.log('installing cache: ' + CACHE_KEY)
      return cache.addAll(
        URLS_TO_PRECACHE.map(url => new Request(url, {
          cache: 'no-cache' // bypass Github Pages 10min cache
        })))
    })
  )
})

// Delete outdated caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keyList => {
      // `keyList` contains all cache names under your username.github.io
      const toDelete = keyList.filter(key =>
        key.startsWith(`${APP_PREFIX}:`) &&
        !key.endsWith(VERSION))
      return Promise.all(toDelete.map(key => {
        console.log('deleting cache: ' + key)
        return caches.delete(key)
      }))
    })
  )
})

// Update sw manually (if old one is controlling atleast one tab)
// Note that we can't prevent these:
// 1) browser will fetch regularly, auto-install new sw and put it on waiting state even if .register isn't called (it just need to be called the first time)
// 2) browser will auto-activate a new waiting sw if no tab is being controlled by old one (e.g. on hard refresh)
// 3) a new sw may force its activation within its code by calling self.skipWaiting() (e.g. on 'install' before the e.waitUntil(...))
self.addEventListener('message', e => {
  if (e.data.code === 'SKIP_WAITING') {
    self.skipWaiting() // fires 'controllerchange'
  }
})
