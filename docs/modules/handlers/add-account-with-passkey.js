import { router } from 'router'
import { getPrivkeyFromSecureElement, PASSKEY_LARGE_BLOB_MISSING_CODE, PASSKEY_PRF_MISSING_CODE } from 'passkey-manager'
import NostrSigner from 'nostr-signer'
import { getPublicKey, npubEncode } from 'nostr'
import idb from 'idb'
import { getProfile, getRelays } from 'queries'
import { freeRelays } from 'nostr-relays'
import { getSvgAvatar } from 'avatar'
import { showSuccessOverlay, showErrorOverlay, getRandomId } from 'helpers/misc.js'
import { setAccountsState } from 'messenger'
import { t } from 'translator'

let goBackTimeout = null

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

function init () {
  const loadAccountBtn = document.querySelector('#\\/add-account-with-passkey button.load-account')
  loadAccountBtn.addEventListener('click', onButtonClick)

  function onUnmount () {
    clearTimeout(goBackTimeout)
    // Reset button state when leaving the route
    enableButton()
  }

  router.addEventListener('routechange', e => {
    if (e.detail.state.route !== '/add-account-with-passkey') return

    router.addEventListener('routechange', onUnmount, { once: true })
  })
}

function disableButton () {
  const loadAccountBtn = document.querySelector('#\\/add-account-with-passkey button.load-account')
  loadAccountBtn.disabled = true
  loadAccountBtn.getElementsByClassName('t-load-account-button')[0].classList.add('pulsate')
}

function enableButton () {
  const loadAccountBtn = document.querySelector('#\\/add-account-with-passkey button.load-account')
  loadAccountBtn.disabled = false
  loadAccountBtn.getElementsByClassName('t-load-account-button')[0].classList.remove('pulsate')
}

async function onButtonClick () {
  disableButton()

  try {
    // Get private key from secure element
    const { passkeyRawId, privkey, prf } = await getPrivkeyFromSecureElement()
    const pubkey = getPublicKey(privkey)

    // Check if account already exists in idb
    const accountExists = await idb.getAccountByPubkey(pubkey)
    if (!accountExists) {
      try {
        const profile = await getProfile(pubkey, { _getSvgAvatar: getSvgAvatar })
        const relays = await getRelays(pubkey)

        // Account object similar to new-account.js
        const account = {
          pubkey,
          passkeyRawId,
          ...(prf?.length ? { prf } : {}),
          profile: {
            name: profile.name,
            about: profile.about,
            picture: profile.picture,
            npub: profile.npub,
            meta: profile.meta
          },
          relays: {
            read: relays.read,
            write: relays.write,
            meta: relays.meta
          }
        }

        await idb.createOrUpdateAccount(account)
      } catch (err) {
        console.error('Failed to fetch profile/relays from network:', err)
        const account = {
          pubkey,
          passkeyRawId,
          ...(prf?.length ? { prf } : {}),
          profile: {
            name: `User#${getRandomId().slice(0, 5)}`,
            about: '',
            picture: await getSvgAvatar(pubkey),
            npub: npubEncode(pubkey),
            meta: { events: [] }
          },
          relays: {
            read: freeRelays.slice(0, 2),
            write: freeRelays.slice(0, 2),
            meta: { events: [] }
          }
        }
        await idb.createOrUpdateAccount(account)
      }
    } else {
      const needsPrfUpdate = prf?.length && !toUint8Array(accountExists.prf)?.length
      const passkeyChanged = passkeyRawId?.length && !areUint8ArraysEqual(accountExists.passkeyRawId, passkeyRawId)
      if (needsPrfUpdate || passkeyChanged) {
        await idb.createOrUpdateAccount({
          ...accountExists,
          passkeyRawId: passkeyChanged ? passkeyRawId : accountExists.passkeyRawId,
          ...(needsPrfUpdate ? { prf } : {})
        })
      }
    }

    // Memoize the signer to keep privkey access
    NostrSigner.getOrCreate(privkey)
    setAccountsState() // async, don't await

    showSuccessOverlay(t({ key: 'accountLoadedSuccessfully' }))

    // Go back to home page after short delay
    goBackTimeout = setTimeout(() => {
      router.goBack({ toRoot: true })
    }, 1500)
  } catch (err) {
    console.error('Failed to load account from passkey:', err)
    if (err?.code === PASSKEY_LARGE_BLOB_MISSING_CODE) {
      showErrorOverlay(t({ key: 'accountLoadError' }), t({ key: 'passkeyLargeBlobMissing' }))
    } else if (err?.code === PASSKEY_PRF_MISSING_CODE) {
      showErrorOverlay(t({ key: 'accountLoadError' }), t({ key: 'passkeyPrfMissing' }))
    } else {
      showErrorOverlay(t({ key: 'accountLoadError' }), err.message)
    }
  }

  enableButton()
}

export {
  init
}
