import idb from 'idb'
import { getSvgAvatar } from 'avatar'
import { npubEncode } from 'nostr'
import { t } from 'translator'
import { router } from 'router'
import { showErrorOverlay } from 'helpers/misc.js'
import { setAccountsState } from 'messenger'
import NostrSigner from 'nostr-signer'

let isActive = false

function init () {
  // Handle route changes
  router.addEventListener('routechange', e => {
    if (e.detail.state.route !== '/logout') {
      isActive = false
      return
    }

    if (!isActive) {
      isActive = true
      loadLogoutAccounts()
    }

    // Add unmount handler for cleanup when leaving route
    router.addEventListener('routechange', onUnmount, { once: true })
  })
}

function onUnmount () {
  isActive = false
  // Clear any pending async operations or reset state if needed
}

async function loadLogoutAccounts () {
  const container = document.querySelector('#logout-accounts-list')
  const parentContainer = container?.parentElement
  if (!container || !parentContainer) return

  try {
    // Show loading state outside the list container
    parentContainer.innerHTML = `<div class="loading">${t({ key: 'loadingAccounts' })}</div>`

    // Get all accounts from IndexedDB
    const accounts = await idb.getAllAccounts()

    if (!accounts || accounts.length === 0) {
      parentContainer.innerHTML = `<div class="no-accounts">${t({ key: 'noAccountsFound' })}</div>`
      // Trigger dimension update for empty state
      requestAnimationFrame(() => {
        router.dispatchEvent(new CustomEvent('content-changed'))
      })
      return
    }

    // Restore the container and populate with accounts
    parentContainer.innerHTML = '<div id="logout-accounts-list"></div>'
    const newContainer = parentContainer.querySelector('#logout-accounts-list')

    // Create account items
    for (const account of accounts) {
      const accountItem = await createAccountItem(account)
      newContainer.appendChild(accountItem)
    }

    // Trigger dimension update after accounts are loaded
    requestAnimationFrame(() => {
      router.dispatchEvent(new CustomEvent('content-changed'))
    })
  } catch (error) {
    console.error('Error loading logout accounts:', error)
    showErrorOverlay(t({ key: 'errorLoadingAccounts' }), error.message)
  }
}

async function createAccountItem (account) {
  const item = document.createElement('div')
  item.className = 'account-item'
  item.dataset.pubkey = account.pubkey // Store pubkey for easy removal

  // Create avatar element with loading placeholder
  const avatar = document.createElement('div')
  avatar.className = 'account-avatar'
  avatar.innerHTML = '<div class="account-avatar-placeholder"></div>'

  // Create account info
  const info = document.createElement('div')
  info.className = 'account-info'

  // Create name and npub elements
  const name = document.createElement('div')
  const npub = account.profile?.npub || npubEncode(account.pubkey)
  name.className = 'account-name'
  name.textContent = account.profile?.name || `Account ${npub.slice(0, 8)}...`

  const pubkeyElement = document.createElement('div')
  pubkeyElement.className = 'account-npub'
  pubkeyElement.textContent = `${npub.slice(0, 12)}...${npub.slice(-4)}`
  pubkeyElement.style.cursor = 'pointer'
  pubkeyElement.title = t({ key: 'clickToCopyNpub' })

  // Add click handler to copy npub
  pubkeyElement.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(npub)

      // Show success feedback
      const originalText = pubkeyElement.textContent
      const originalColor = pubkeyElement.style.color

      pubkeyElement.textContent = t({ key: 'npubCopied' })
      pubkeyElement.style.color = '#22c55e'

      // Restore original text after 2 seconds
      setTimeout(() => {
        pubkeyElement.textContent = originalText
        pubkeyElement.style.color = originalColor
      }, 2000)
    } catch (error) {
      console.error('Error copying npub:', error)
      // Show error feedback briefly
      const originalText = pubkeyElement.textContent
      const originalColor = pubkeyElement.style.color

      pubkeyElement.textContent = t({ key: 'copyFailed' })
      pubkeyElement.style.color = '#ef4444'

      setTimeout(() => {
        pubkeyElement.textContent = originalText
        pubkeyElement.style.color = originalColor
      }, 2000)
    }
  })

  info.appendChild(name)
  info.appendChild(pubkeyElement)

  // Create logout button
  const logoutButton = document.createElement('button')
  logoutButton.className = 'logout-account-btn'
  logoutButton.innerHTML = '<i class="gg-log-out"></i>'
  logoutButton.title = t({ key: 'logoutAccount' })
  logoutButton.addEventListener('click', () => logoutAccount(account, item))

  // Assemble item
  item.appendChild(avatar)
  item.appendChild(info)
  item.appendChild(logoutButton)

  // Load avatar asynchronously
  loadAccountAvatar(avatar, account)

  return item
}

async function loadAccountAvatar (avatarElement, account) {
  try {
    // Try to load profile picture if available
    if (account.profile?.picture) {
      const img = document.createElement('img')
      img.className = 'account-avatar-img'
      img.src = account.profile.picture

      img.onload = () => {
        avatarElement.innerHTML = ''
        avatarElement.appendChild(img)
      }

      img.onerror = () => {
        // Fallback to generated SVG avatar
        loadSvgAvatar(avatarElement, account)
      }
    } else {
      // Use generated SVG avatar
      loadSvgAvatar(avatarElement, account)
    }
  } catch (error) {
    console.error('Error loading avatar:', error)
    loadSvgAvatar(avatarElement, account)
  }
}

async function loadSvgAvatar (avatarElement, account) {
  try {
    const svgAvatar = await getSvgAvatar(account.pubkey)
    avatarElement.innerHTML = svgAvatar
  } catch (error) {
    console.error('Error generating SVG avatar:', error)
    // Keep placeholder if SVG generation fails
  }
}

async function logoutAccount (account, itemElement) {
  try {
    // Cleanup signer and delete account from IndexedDB
    NostrSigner.cleanup(account.pubkey)
    await idb.deleteAccountByPubkey(account.pubkey)
    setAccountsState() // async, don't await

    // Remove the account item from the DOM
    itemElement.remove()

    // Check if there are any accounts left
    const container = document.querySelector('#logout-accounts-list')
    if (container && container.children.length === 0) {
      const parentContainer = container.parentElement
      if (parentContainer) {
        parentContainer.innerHTML = `<div class="no-accounts">${t({ key: 'noAccountsFound' })}</div>`
      }
    }

    // Trigger dimension update after account removal
    requestAnimationFrame(() => {
      router.dispatchEvent(new CustomEvent('content-changed'))
    })
  } catch (error) {
    console.error('Error logging out account:', error)
    showErrorOverlay(t({ key: 'logoutAccountError' }), error.message)
  }
}

export {
  init
}
