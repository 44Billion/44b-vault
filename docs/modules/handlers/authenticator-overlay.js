import { router } from 'router'
import NostrSigner from 'nostr-signer'

function init () {
  // Authenticator overlay cards
  const authenticatorCards = document.querySelectorAll('#authenticator-overlay .authenticator-card')
  authenticatorCards.forEach(card => {
    card.addEventListener('click', () => {
      const route = card.getAttribute('data-route')
      if (route) {
        hideAuthenticatorOverlay()
        router.goToRoute({ route })
      }
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
  router.addEventListener('routechange', (e) => {
    const currentRoute = e.detail.state.route

    // If on home page and no users are signed in, show overlay
    if (currentRoute === '/' && !NostrSigner.hasLoggedInUsers) {
      // showAuthenticatorOverlay()
    } else if (NostrSigner.hasLoggedInUsers) {
      // If users are signed in, always hide overlay regardless of route
      hideAuthenticatorOverlay()
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
  const overlay = document.getElementById('authenticator-overlay')
  if (overlay) {
    overlay.classList.add('invisible')
  }
}

async function maybeShowAuthenticatorOverlay () {
  // Show authenticator overlay only if no users are signed in
  if (!NostrSigner.hasLoggedInUsers) {
    // showAuthenticatorOverlay()
  }
}

init()

export {
  showAuthenticatorOverlay,
  hideAuthenticatorOverlay,
  maybeShowAuthenticatorOverlay
}
