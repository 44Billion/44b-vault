import { router } from 'router'
import NostrSigner from 'nostr-signer'
import { getPublicKey, npubEncode, nip19Decode } from 'nostr'
import idb from 'idb'
import { getProfile, getRelays } from 'queries'
import { freeRelays } from 'nostr-relays'
import { getSvgAvatar } from 'avatar'
import { storeAccountPrivkeyInSecureElement, ensurePasskeyEncryptedBackup, signalPasskeyCurrentUserDetails } from 'passkey-manager'
import { showSuccessOverlay, showErrorOverlay, getRandomId, bytesToHex } from 'helpers/misc.js'
import { setAccountsState } from 'messenger'
import { t } from 'translator'

let goBackTimeout = null

function init () {
  const nsecInput = document.getElementById('nsec-input')
  const toggleVisibilityBtn = document.getElementById('toggle-nsec-visibility')
  const addAccountBtn = document.querySelector('#\\/add-account-with-nsec button.add-account-with-nsec')

  // Toggle password visibility
  toggleVisibilityBtn.addEventListener('click', () => {
    const isPassword = nsecInput.type === 'password'
    nsecInput.type = isPassword ? 'text' : 'password'

    const eyeIcon = toggleVisibilityBtn.querySelector('i')
    eyeIcon.className = isPassword ? 'gg-eye-alt' : 'gg-eye'
  })

  addAccountBtn.addEventListener('click', onButtonClick)

  function onUnmount () {
    clearTimeout(goBackTimeout)
    clearInput()
    enableButton()
  }

  router.addEventListener('routechange', e => {
    if (e.detail.state.route !== '/add-account-with-nsec') return

    router.addEventListener('routechange', onUnmount, { once: true })
  })
}

function disableButton () {
  const addAccountBtn = document.querySelector('#\\/add-account-with-nsec button.add-account-with-nsec')
  addAccountBtn.disabled = true
  addAccountBtn.getElementsByClassName('t-add-account-with-nsec-button')[0].classList.add('pulsate')
}

function enableButton () {
  const addAccountBtn = document.querySelector('#\\/add-account-with-nsec button.add-account-with-nsec')
  addAccountBtn.disabled = false
  addAccountBtn.getElementsByClassName('t-add-account-with-nsec-button')[0].classList.remove('pulsate')
}

function clearInput () {
  const nsecInput = document.getElementById('nsec-input')
  const toggleVisibilityBtn = document.getElementById('toggle-nsec-visibility')

  nsecInput.value = ''
  nsecInput.type = 'password'
  const eyeIcon = toggleVisibilityBtn.querySelector('i')
  eyeIcon.className = 'gg-eye'
}

async function onButtonClick () {
  const nsecInput = document.getElementById('nsec-input')

  disableButton()

  try {
    const nsecValue = nsecInput.value.trim().toLowerCase()

    if (!nsecValue) {
      throw new Error(t({ key: 'nsecRequired' }))
    }

    let privkey
    try {
      if (nsecValue.startsWith('nsec1')) {
        const decoded = nip19Decode(nsecValue)
        if (decoded.type !== 'nsec') {
          throw new Error('Invalid nsec format')
        }
        privkey = bytesToHex(decoded.data)
      } else if (/^[0-9a-f]{64}$/.test(nsecValue)) {
        privkey = nsecValue
      } else {
        throw new Error('Invalid private key format. Use nsec1... or 64-character hex.')
      }
    } catch (_err) {
      throw new Error(t({ key: 'invalidNsec' }))
    }

    const pubkey = getPublicKey(privkey)

    // Check if account already exists in idb
    const accountExists = await idb.getAccountByPubkey(pubkey)
    if (!accountExists) {
      let passkeyRawId
      let prf
      let profile
      let relays
      const fallbackName = `User#${getRandomId().slice(0, 5)}`

      try {
        ({ passkeyRawId, prf } = await storeAccountPrivkeyInSecureElement({
          privkey,
          displayName: fallbackName
        }))
      } catch (err) {
        console.error('Failed to store private key as passkey:', err)
        throw new Error(t({ key: 'passkeyStoreFailed' }))
      }

      try {
        relays = await getRelays(pubkey)
      } catch (err) {
        console.error('Failed to fetch relays from network:', err)
        const defaultRelays = freeRelays.slice(0, 2)
        relays = {
          read: defaultRelays,
          write: defaultRelays,
          meta: { events: [] }
        }
      }
      try {
        profile = await getProfile(pubkey, { _getSvgAvatar: getSvgAvatar })
      } catch (err) {
        console.error('Failed to fetch profile from network:', err)
        profile = {
          name: fallbackName,
          about: '',
          picture: await getSvgAvatar(pubkey),
          npub: npubEncode(pubkey),
          meta: { events: [] }
        }
      }

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

      // if it isn't a fallback profile, signal details
      if (profile.meta.events.length) {
        await signalPasskeyCurrentUserDetails({
          pubkey,
          displayName: profile.name,
          iconURL: profile.picture
        })
      }
    } else if (accountExists?.passkeyRawId) {
      try {
        await ensurePasskeyEncryptedBackup({ passkeyRawId: accountExists.passkeyRawId, privkey })
      } catch (err) {
        console.error('Failed to ensure encrypted passkey backup:', err)
      }
    }

    // Memoize the signer to keep privkey access
    NostrSigner.getOrCreate(privkey)
    setAccountsState() // async, don't await

    showSuccessOverlay(t({ key: 'accountLoadedSuccessfully' }))
    clearInput()

    // Go back to home page after short delay
    goBackTimeout = setTimeout(() => {
      router.goBack({ toRoot: true })
    }, 1500)
  } catch (err) {
    console.error('Failed to add account with nsec:', err)
    showErrorOverlay(t({ key: 'accountLoadError' }), err.message)
  }

  enableButton()
}

export {
  init
}
