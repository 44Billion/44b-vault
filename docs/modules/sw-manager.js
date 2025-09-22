export async function initSw ({ swUpdateReadyHandler }) {
  if (!('serviceWorker' in navigator)) return

  const registration = await registerSw()
  handleSwUpdate({ registration, swUpdateReadyHandler })
}

async function registerSw () {
  if (!('serviceWorker' in navigator)) return

  // It won't wait for sw 'install' completion.
  // Once register() run, browser auto checks for sw updates, event if we
  // don't call it on next visits.
  // register() is effectively a no-op during subsequent visits,
  // unless we change the URL of the service worker script (bad practice)
  const registration = await navigator.serviceWorker.register('./sw.js')
  // check for sw updates besides the browser auto checks
  setInterval(() => registration.update(), 60 * 60 * 1000)
  return registration
}

function handleSwUpdate ({ registration, swUpdateReadyHandler }) {
  // If missed 'updatefound' event.
  // 'waiting' means successfully installed, waiting for activation
  // The first sw will be installing (registration.installing)
  // when running code gets here
  if (registration.waiting) swUpdateReadyHandler(registration)

  // fired by registration.update() or
  // by auto update check from time to time after sw was registered
  registration.addEventListener('updatefound', () => {
    registration.installing?.addEventListener?.('statechange', () => {
      if (
        !registration.waiting ||
        // controller is the previous sw
        !navigator.serviceWorker.controller
      ) return

      swUpdateReadyHandler(registration)
    })
  })

  let refreshing = false
  // fired by sw.skipWaiting()
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })
}
