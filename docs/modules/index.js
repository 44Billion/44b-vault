import { initDb } from 'idb'
import { initSw } from 'sw-manager'
import { initConfig, config } from 'config'
import { initSession } from 'session-manager'
import { initTranslation } from 'translator'
import { changeDimensions } from 'messenger'
import { initHandlers } from 'handlers'
import { getQueryParam } from 'helpers/misc.js'
import { maybeShowAuthenticatorOverlay } from 'handlers/authenticator-overlay.js'

// await initSw({ swUpdateReadyHandler })
await initConfig()
await initDb()

;(function protectFromClickjacking () {
  const isntInIframe = window === window.top
  if (
    isntInIframe ||
    // window will always be in an iframe when previewing on vscode
    config.isDev
  ) {
    load(isntInIframe)
  } else {
    if (window.parent !== window.top) return
    const abortController = new AbortController()
    window.addEventListener('message', e => {
      if (
        e.data?.code === 'RENDER' && (
          config.isDev ||
          e.origin === 'https://44billion.net'
        )
      ) {
        load(isntInIframe)
        abortController.abort()
      }
    }, { signal: abortController.signal })
  }
})()

async function load (isntInIframe) {
  // await initSession()
  await initTranslation()
  await initHandlers()
  await showBody(isntInIframe)
}

async function showBody (isntInIframe) {
  if (isntInIframe) document.body.classList.add('detached')
  if (config.isDev) {
    console.log('config', config)
    document.body.classList.add('vscode')
    document.getElementById('view').style.transition = 'none'
    document.getElementById('pages').style.transition = 'none'
  }
  if (config.mode !== 'widget') document.getElementById('/').classList.add('invisible')
  await maybeShowAuthenticatorOverlay()
  document.body.classList.remove('invisible')

  const oldHeight = document.getElementById('vault').getBoundingClientRect().height
  const nextViewHeight = document.querySelector('#page-0 > div:not(.invisible)').getBoundingClientRect().height
  const diffViewHeight = nextViewHeight - document.getElementById('view').getBoundingClientRect().height
  changeDimensions({ height: oldHeight + diffViewHeight })

  // set initial view height
  document.getElementById('view').style.height = `${nextViewHeight}px`
}

function swUpdateReadyHandler (registration) {
  const swUpdateBtn = document.getElementById('update-vault-btn')
  swUpdateBtn.addEventListener('click', () => {
    if (!registration.waiting) return

    registration.waiting.postMessage({ code: 'SKIP_WAITING' })
  }, { once: true })
  swUpdateBtn.classList.remove('invisible')
  const page = getQueryParam('page') || 0
  if (page !== 0) return

  const oldHeight = document.getElementById('vault').getBoundingClientRect().height
  const nextViewHeight = document.querySelector('#page-0 > div:not(.invisible)').getBoundingClientRect().height
  const diffViewHeight = nextViewHeight - document.getElementById('view').style.height.split('px')[0]
  changeDimensions({ height: oldHeight + diffViewHeight })

  document.getElementById('view').style.height = `${nextViewHeight}px`
}
