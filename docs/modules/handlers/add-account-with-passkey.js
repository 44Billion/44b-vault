import { router } from 'router'
import { getPrivkeyFromSecureElement } from 'passkey-manager'
import NostrSigner from 'nostr-signer'
import { getPublicKey, npubEncode } from 'nostr'
import idb from 'idb'
import { getProfile, getRelays } from 'queries'
import { freeRelays } from 'nostr-relays'
import { getSvgAvatar } from 'avatar'
import { showSuccessOverlay, showErrorOverlay, getRandomId } from 'helpers/misc.js'
import { t } from 'translator'

const loadAccountBtn = document.querySelector('#\\/add-account-with-passkey button.load-account')
loadAccountBtn.addEventListener('click', onButtonClick)

function disableButton () {
  loadAccountBtn.disabled = true
  loadAccountBtn.getElementsByClassName('t-load-account-button')[0].classList.add('pulsate')
}

function enableButton () {
  loadAccountBtn.disabled = false
  loadAccountBtn.getElementsByClassName('t-load-account-button')[0].classList.remove('pulsate')
}

let goBackTimeout = null
async function onButtonClick () {
  disableButton()

  try {
    // Get private key from secure element
    const privkey = await getPrivkeyFromSecureElement()
    console.log('Loaded privkey from passkey:', privkey, typeof privkey)
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
    }

    // Memoize the signer to keep privkey access
    NostrSigner.getOrCreate(privkey)

    showSuccessOverlay(t({ key: 'accountLoadedSuccessfully' }))

    // Go back to home page after short delay
    goBackTimeout = setTimeout(() => {
      router.goBack({ toRoot: true })
    }, 1500)
  } catch (err) {
    console.error('Failed to load account from passkey:', err)
    showErrorOverlay(t({ key: 'accountLoadError' }), err.message)
  }

  enableButton()
}

function onUnmount () {
  clearTimeout(goBackTimeout)
  // Reset button state when leaving the route
  enableButton()
}

router.addEventListener('routechange', e => {
  if (e.detail.state.route !== '/add-account-with-passkey') return

  router.addEventListener('routechange', onUnmount, { once: true })
})
