import { t } from 'translator'

// getQueryParam('a') => returns '' for ?a
// getQueryParam('b') => returns null for ?a
const getQueryParam = (() => {
  let memo
  return (key, { search = window.location.search } = {}) => {
    if (!memo?.[search]) memo = { [search]: new URLSearchParams(search) }
    return memo[search].get(key)
  }
})()

const typeof2 = variable => Object.prototype.toString.call(variable).slice(8, -1).toLowerCase()

function getRandomId () { return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) }

function bytesToHex (uint8aBytes) {
  return Array.from(uint8aBytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes (hexString) {
  const arr = new Uint8Array(hexString.length / 2) // create result array
  for (let i = 0; i < arr.length; i++) {
    const j = i * 2
    const h = hexString.slice(j, j + 2)
    const b = Number.parseInt(h, 16) // byte, created from string part
    if (Number.isNaN(b) || b < 0) throw new Error('invalid hex')
    arr[i] = b
  }
  return arr
}

function maybeUnref (timer) {
  if (typeof window === 'undefined') timer.unref()
  return timer
}

function showSuccessOverlay (message = null) {
  const overlay = document.getElementById('success-overlay')
  if (message) {
    const messageElement = overlay.querySelector('.t-success-message')
    messageElement.textContent = message
  }
  overlay.classList.remove('invisible')
}

function hideSuccessOverlay () {
  const overlay = document.getElementById('success-overlay')
  if (overlay) {
    overlay.classList.add('invisible')
  }
}

function showErrorOverlay (message = null, errorDetails = null) {
  const overlay = document.getElementById('error-overlay')
  const messageElement = overlay.querySelector('.t-error-message')
  messageElement.textContent = message || t({ key: 'errorMessage' })

  if (!errorDetails) {
    // window.location.search = "?error=Network connection failed"
    const urlParams = new URLSearchParams(window.location.search)
    errorDetails = urlParams.get('error')
  }
  const detailsElement = overlay.querySelector('#error-details')
  if (errorDetails) {
    detailsElement.textContent = errorDetails
    detailsElement.classList.remove('invisible')
  } else {
    detailsElement.classList.add('invisible')
  }

  overlay.classList.remove('invisible')
}

function hideErrorOverlay () {
  const overlay = document.getElementById('error-overlay')
  if (overlay) {
    overlay.classList.add('invisible')
    // Also hide error details
    const detailsElement = overlay.querySelector('#error-details')
    if (detailsElement) {
      detailsElement.classList.add('invisible')
    }
  }
}

export {
  getQueryParam,
  typeof2,
  getRandomId,
  bytesToHex,
  hexToBytes,
  maybeUnref,
  showSuccessOverlay,
  hideSuccessOverlay,
  showErrorOverlay,
  hideErrorOverlay
}
