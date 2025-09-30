import { router } from 'router'
import NostrSigner from 'nostr-signer'
import { getPublicKey, npubEncode, nip19Decode } from 'nostr'
import idb from 'idb'
import { getProfile, getRelays } from 'queries'
import { freeRelays } from 'nostr-relays'
import { getSvgAvatar } from 'avatar'
import { storeAccountPrivkeyInSecureElement } from 'passkey-manager'
import { showSuccessOverlay, showErrorOverlay, getRandomId } from 'helpers/misc.js'
import { setAccountsState } from 'messenger'
import { t } from 'translator'

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

function disableButton () {
  addAccountBtn.disabled = true
  addAccountBtn.getElementsByClassName('t-add-account-with-nsec-button')[0].classList.add('pulsate')
}

function enableButton () {
  addAccountBtn.disabled = false
  addAccountBtn.getElementsByClassName('t-add-account-with-nsec-button')[0].classList.remove('pulsate')
}

function clearInput () {
  nsecInput.value = ''
  nsecInput.type = 'password'
  const eyeIcon = toggleVisibilityBtn.querySelector('i')
  eyeIcon.className = 'gg-eye'
}

let goBackTimeout = null
async function onButtonClick () {
  disableButton()

  try {
    const nsecValue = nsecInput.value.trim()

    if (!nsecValue) {
      throw new Error(t({ key: 'nsecRequired' }))
    }

    let privkey
    try {
      if (nsecValue.startsWith('nsec1')) {
        // Decode nsec using nip19Decode
        const decoded = nip19Decode(nsecValue)
        if (decoded.type !== 'nsec') {
          throw new Error('Invalid nsec format')
        }
        privkey = decoded.data
      } else if (nsecValue.length === 64 && /^[0-9a-fA-F]+$/.test(nsecValue)) {
        // Hex private key
        privkey = nsecValue.toLowerCase()
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
      let profile, relays

      try {
        // Fetch profile and relays first
        profile = await getProfile(pubkey, { _getSvgAvatar: getSvgAvatar })
        relays = await getRelays(pubkey)
      } catch (err) {
        console.error('Failed to fetch profile/relays from network:', err)
        // Use fallback profile/relays
        profile = {
          name: `User#${getRandomId().slice(0, 5)}`,
          about: '',
          picture: await getSvgAvatar(pubkey),
          npub: npubEncode(pubkey),
          meta: { events: [] }
        }
        relays = {
          read: freeRelays.slice(0, 2),
          write: freeRelays.slice(0, 2),
          meta: { events: [] }
        }
      }

      try {
        // Store the private key as a passkey using the profile name
        ({ passkeyRawId } = await storeAccountPrivkeyInSecureElement({
          privkey,
          displayName: profile.name
        }))
      } catch (err) {
        console.error('Failed to store private key as passkey:', err)
        throw new Error(t({ key: 'passkeyStoreFailed' }))
      }

      // Create account object
      const account = {
        pubkey,
        passkeyRawId,
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

function onUnmount () {
  clearTimeout(goBackTimeout)
  clearInput()
  enableButton()
}

router.addEventListener('routechange', e => {
  if (e.detail.state.route !== '/add-account-with-nsec') return

  router.addEventListener('routechange', onUnmount, { once: true })
})
