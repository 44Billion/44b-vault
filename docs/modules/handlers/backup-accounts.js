import idb from 'idb'
import { getSvgAvatar } from 'avatar'
import { reauthenticateWithPasskey } from 'passkey-manager'
import { npubEncode, nsecEncode } from 'nostr'
import { t } from 'translator'
import { router } from 'router'
import { showSuccessOverlay, showErrorOverlay } from 'helpers/misc.js'

let isActive = false

// Handle route changes
router.addEventListener('routechange', e => {
  if (e.detail.state.route !== '/backup-accounts') {
    isActive = false
    return
  }

  if (!isActive) {
    isActive = true
    loadBackupAccounts()
  }

  // Add unmount handler for cleanup when leaving route
  router.addEventListener('routechange', onUnmount, { once: true })
})

function onUnmount () {
  isActive = false
  // Clear any pending async operations or reset state if needed
}

async function loadBackupAccounts () {
  const container = document.querySelector('#backup-accounts-list')
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
    parentContainer.innerHTML = '<div id="backup-accounts-list"></div>'
    const newContainer = parentContainer.querySelector('#backup-accounts-list')

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
    console.error('Error loading backup accounts:', error)
    showErrorOverlay(t({ key: 'errorLoadingAccounts' }), error.message)
  }
}

async function createAccountItem (account) {
  const item = document.createElement('div')
  item.className = 'account-item'

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

  // Create copy button
  const copyButton = document.createElement('button')
  copyButton.className = 'copy-nsec-btn'
  copyButton.innerHTML = '<i class="copy-icon"></i>'
  copyButton.title = t({ key: 'copyNsec' })
  copyButton.addEventListener('click', () => copyNsec(account))

  // Assemble item
  item.appendChild(avatar)
  item.appendChild(info)
  item.appendChild(copyButton)

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

async function copyNsec (account) {
  try {
    // Require passkey authentication for sensitive operation
    const result = await reauthenticateWithPasskey(account.pubkey, account.passkeyRawId)

    if (!result.success) {
      showErrorOverlay(t({ key: 'authenticationRequired' }))
      return
    }

    // Encode private key as nsec
    const nsec = nsecEncode(result.rawPrivkey)

    // Copy to clipboard
    await navigator.clipboard.writeText(nsec)

    showSuccessOverlay(t({ key: 'nsecCopiedSuccessfully' }))
  } catch (error) {
    console.error('Error copying nsec:', error)

    if (error.message?.includes('authentication') || error.name?.includes('NotAllowed')) {
      showErrorOverlay(t({ key: 'authenticationFailedDueToInactivity' }))
    } else {
      showErrorOverlay(t({ key: 'nsecCopyError' }))
    }
  }
}
