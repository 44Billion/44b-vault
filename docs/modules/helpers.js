// getQueryParam('a') => returns '' for ?a
// getQueryParam('b') => returns null for ?a
const getQueryParam = (() => {
  let memo
  return (key, { search = window.location.search } = {}) => {
    if (!memo?.[search]) memo = { [search]: new URLSearchParams(search) }
    return memo[search].get(key)
  }
})()

const toKebabCase = string =>
  string
    .replace(
      /\.?([A-Z0-9]+)/g,
      (_match, chars) => '-' + chars.toLowerCase()
    ).replace(/^-/, '')

const toAllCaps = string =>
  string
    .replace(
      /\.?([A-Z0-9]+)/g,
      (_match, chars) => '_' + chars
    )
    .replace(/^_/, '')
    .toUpperCase()

const typeof2 = variable => Object.prototype.toString.call(variable).slice(8, -1).toLowerCase()

function getRandomId () { return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) }

function bytesToHex (uint8aBytes) {
  return Array.from(uint8aBytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes (hexString) {
  const arr = new Uint8Array(hexString.length / 2); // create result array
  for (let i = 0; i < arr.length; i++) {
    const j = i * 2;
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

export {
  getQueryParam,
  toKebabCase,
  toAllCaps,
  typeof2,
  getRandomId,
  bytesToHex,
  hexToBytes,
  maybeUnref
}
