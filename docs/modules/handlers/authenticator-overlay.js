import { router } from 'router'
import idb from 'idb'

function init () {
  // Authenticator overlay cards
  const authenticatorCards = document.querySelectorAll('#authenticator-overlay .authenticator-card')
  authenticatorCards.forEach(card => {
    card.addEventListener('click', () => {
      const route = card.getAttribute('data-route')
      if (route) router.goToRoute({ route })
    })
  })

  // Secondary text link
  const textLinks = document.querySelectorAll('#authenticator-overlay .text-link')
  textLinks.forEach(link => {
    link.addEventListener('click', () => {
      const route = link.getAttribute('data-route')
      if (route) {
        hideAuthenticatorOverlay()
        router.goToRoute({ route })
      }
    })
  })

  // Listen for route changes to show/hide overlay based on auth state
  router.addEventListener('routechange', async e => {
    const currentRoute = e.detail.state.route

    if (await idb.hasLoggedInUsers()) {
      hideAuthenticatorOverlay()
    } else {
      if (currentRoute === '/') showAuthenticatorOverlay()
      else hideAuthenticatorOverlay()
    }
  })
}

function showAuthenticatorOverlay () {
  const overlay = document.getElementById('authenticator-overlay')
  if (overlay) {
    overlay.classList.remove('invisible')
  }
}

function hideAuthenticatorOverlay () {
  setTimeout(() => {
    const overlay = document.getElementById('authenticator-overlay')
    if (overlay) {
      overlay.classList.add('invisible')
    }
  }, 100)
}

async function maybeShowAuthenticatorOverlay () {
  if (!(await idb.hasLoggedInUsers())) showAuthenticatorOverlay()
}

init()

export {
  showAuthenticatorOverlay,
  hideAuthenticatorOverlay,
  maybeShowAuthenticatorOverlay
}
