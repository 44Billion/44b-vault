import { getSvgAvatar } from 'avatar'
import { router } from 'router'
import { generatePrivateKey } from 'nostr'
import { storeAccountPrivkeyInSecureElement } from 'passkey-manager'
import NostrSigner from 'nostr-signer'
import nostrRelays, { seedRelays, freeRelays } from 'nostr-relays'
import { eventToProfile, eventToRelays } from 'queries'
import idb from 'idb'
import { showSuccessOverlay, showErrorOverlay } from 'helpers/misc.js'
import { setAccountsState } from 'messenger'
import { t } from 'translator'

let currentPrivkey = null
let currentPicture = null

const createAccountBtn = document.querySelector('#\\/new-account button.create-account')
createAccountBtn.addEventListener('click', async () => {
  createAccountBtn.disabled = true
  createAccountBtn.getElementsByClassName('t-create-account')[0].classList.add('pulsate')
  try {
    if (!currentPrivkey) await setPrivkeyAndAvatar()
    await createAccount(currentPrivkey)
    showSuccessOverlay()
    currentPrivkey = null
    currentPicture = null
  } catch (err) {
    showErrorOverlay(t({ key: 'createAccountError' }), err.message)
  } finally {
    createAccountBtn.disabled = false
    createAccountBtn.getElementsByClassName('t-create-account')[0].classList.remove('pulsate')
  }
})

const photoPickerBtn = document.querySelector('#\\/new-account button.photo-picker')
const avatarNode = photoPickerBtn.querySelector(':scope > div:first-child')
const avatarIcon = photoPickerBtn.getElementsByClassName('gg-girl')[0]
photoPickerBtn.addEventListener('click', setPrivkeyAndAvatar)
async function setPrivkeyAndAvatar () {
  photoPickerBtn.disabled = true
  currentPrivkey = generatePrivateKey()
  const url = window.encodeURIComponent(await getSvgAvatar(currentPrivkey))
  avatarIcon.classList.add('invisible')
  currentPicture = `data:image/svg+xml;charset=utf-8,${url}`
  avatarNode.style.backgroundImage = `url("${currentPicture}")`
  photoPickerBtn.disabled = false
}

const displayNameInput = document.getElementById('new-account-display-name')
function onUnmout () {
  currentPrivkey = null
  currentPicture = null
  createAccountBtn.disabled = false
  avatarIcon.classList.remove('invisible')
  avatarNode.style.backgroundImage = 'none'
  displayNameInput.value = ''
}
router.addEventListener('routechange', e => {
  if (e.detail.state.route !== '/new-account') return

  router.addEventListener('routechange', onUnmout, { once: true })
})

async function createAccount (privkey) {
  let signer
  try {
    const displayName = displayNameInput.value.trim()
    if (!displayName) {
      throw new Error(t({ key: 'displayNameRequired' }))
    }
    let profileEvent, relaysEvent, now
    try {
      signer = NostrSigner.getOrCreate(privkey)
      now = Math.floor(Date.now() / 1000)
      profileEvent = signer.signEvent({
        kind: 0,
        created_at: now,
        tags: [
          ['name', displayName],
          ...(currentPicture ? [['picture', currentPicture]] : [])
        ],
        content: JSON.stringify({ name: displayName, ...(currentPicture && { picture: currentPicture }) })
      })
    } catch (err) {
      console.error(err)
      throw new Error('PROFILE_SIGN_ERROR')
    }
    let userRelays
    try {
      userRelays = freeRelays.slice(0, 2)
      relaysEvent = signer.signEvent({
        kind: 10002,
        created_at: now,
        tags: userRelays.map(r => ['r', r]),
        content: JSON.stringify({ name: displayName })
      })
    } catch (err) {
      console.error(err)
      throw new Error('RELAYS_SIGN_ERROR')
    }
    let { success, errors } = await nostrRelays.sendEvent(relaysEvent, seedRelays)
    if (!success) {
      console.error(errors.map(({ relay, reason }) => `${relay}: ${reason}`).join('\n'))
      throw new Error('RELAY_EVENT_SEND_ERROR')
    }
    ;({ success, errors } = await nostrRelays.sendEvent(profileEvent, userRelays))
    if (!success) {
      console.error(errors.map(({ relay, reason }) => `${relay}: ${reason}`).join('\n'))
      throw new Error('PROFILE_EVENT_SEND_ERROR')
    }
    let passkeyRawId
    try {
      ({ passkeyRawId } = await storeAccountPrivkeyInSecureElement({ privkey, displayName }))
    } catch (err) {
      console.error(err)
      throw new Error('SECURE_ELEMENT_STORE_ERROR')
    }
    try {
      await idb.createOrUpdateAccount({
        pubkey: signer.getPublicKey(),
        passkeyRawId,
        profile: await eventToProfile(profileEvent, { _getSvgAvatar: getSvgAvatar }),
        relays: eventToRelays(relaysEvent)
      })
      setAccountsState() // async, don't await
    } catch (err) {
      console.error(err)
      throw new Error('IDB_ACCOUNT_CREATE_ERROR')
    }
  } catch (err) {
    if (signer) NostrSigner.revoke(signer)
    throw err
  }
}
