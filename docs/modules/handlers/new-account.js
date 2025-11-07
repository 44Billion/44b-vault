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
import { triggerJob, nostrEventPublisherJobName } from 'worker-service'

let currentPrivkey = null
let currentPicture = null

function init () {
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
}

async function setPrivkeyAndAvatar () {
  const photoPickerBtn = document.querySelector('#\\/new-account button.photo-picker')
  const avatarNode = photoPickerBtn.querySelector(':scope > div:first-child')
  const avatarIcon = photoPickerBtn.getElementsByClassName('gg-girl')[0]

  photoPickerBtn.disabled = true
  currentPrivkey = generatePrivateKey()
  const url = window.encodeURIComponent(await getSvgAvatar(currentPrivkey))
  avatarIcon.classList.add('invisible')
  currentPicture = `data:image/svg+xml;charset=utf-8,${url}`
  avatarNode.style.backgroundImage = `url("${currentPicture}")`
  photoPickerBtn.disabled = false
}

async function createAccount (privkey) {
  let signer
  try {
    const displayNameInput = document.getElementById('new-account-display-name')
    const displayName = displayNameInput.value.trim()
    if (!displayName) {
      throw new Error(t({ key: 'displayNameRequired' }))
    }
    const userRelays = freeRelays.slice(0, 2)
    let passkeyRawId
    let prf
    try {
      ({ passkeyRawId, prf } = await storeAccountPrivkeyInSecureElement({
        privkey,
        displayName,
        writeRelays: userRelays,
        iconURL: currentPicture
      }))
    } catch (err) {
      let errorMessage
      // This detects an error that can sometimes happen when calling
      // navigator.credentials.create() from inside an iframe,
      // e.g. on Chrome if Bitwarden extension is unlocked
      // See https://github.com/bitwarden/clients/issues/12590
      if (
        err.message?.includes("Invalid 'sameOriginWithAncestors' value")
      ) errorMessage = t({ key: 'createAccountInIframeError' })
      else errorMessage = 'SECURE_ELEMENT_STORE_ERROR'
      console.error(err)
      throw new Error(errorMessage)
    }
    let profileEvent
    let relaysEvent
    ({ signer, profileEvent, relaysEvent } = await createBootstrapArtifacts({ privkey, displayName, picture: currentPicture, userRelays }))
    await persistNewAccountRecord({ signer, passkeyRawId, prf, profileEvent, relaysEvent })

    await publishBootstrapEvents({ profileEvent, relaysEvent, userRelays })
  } catch (err) {
    if (signer) NostrSigner.revoke(signer)
    throw err
  }
}

async function createBootstrapArtifacts ({ privkey, displayName, picture, userRelays }) {
  const signer = NostrSigner.getOrCreate(privkey)
  const now = Math.floor(Date.now() / 1000)

  let profileEvent
  try {
    profileEvent = signer.signEvent({
      kind: 0,
      created_at: now,
      tags: [
        ['name', displayName],
        ...(picture ? [['picture', picture]] : [])
      ],
      content: JSON.stringify({ name: displayName, ...(picture && { picture }) })
    })
  } catch (err) {
    console.error(err)
    NostrSigner.revoke(signer)
    throw new Error('PROFILE_SIGN_ERROR')
  }

  let relaysEvent
  try {
    relaysEvent = signer.signEvent({
      kind: 10002,
      created_at: now,
      tags: userRelays.map(r => ['r', r]),
      content: JSON.stringify({ name: displayName })
    })
  } catch (err) {
    console.error(err)
    NostrSigner.revoke(signer)
    throw new Error('RELAYS_SIGN_ERROR')
  }

  return { signer, profileEvent, relaysEvent }
}

async function persistNewAccountRecord ({ signer, passkeyRawId, prf, profileEvent, relaysEvent }) {
  try {
    await idb.createOrUpdateAccount({
      pubkey: signer.getPublicKey(),
      passkeyRawId,
      ...(prf?.length ? { prf } : {}),
      profile: await eventToProfile(profileEvent, { _getSvgAvatar: getSvgAvatar }),
      relays: eventToRelays(relaysEvent)
    })
    setAccountsState() // async, don't await
  } catch (err) {
    console.error(err)
    throw new Error('IDB_ACCOUNT_CREATE_ERROR')
  }
}

async function publishBootstrapEvents ({ profileEvent, relaysEvent, userRelays }) {
  const tasks = [
    { event: relaysEvent, relays: seedRelays },
    { event: profileEvent, relays: userRelays }
  ]

  let enqueued = false

  for (const { event, relays } of tasks) {
    if (!event || !Array.isArray(relays) || relays.length === 0) continue

    try {
      const { success, errors } = await nostrRelays.sendEvent(event, relays)
      if (success) continue

      if (errors?.length) {
        console.error(errors.map(({ relay, reason }) => `${relay}: ${reason}`).join('\n'))
      }
      enqueued = (await persistForRetry(event, relays)) || enqueued
    } catch (err) {
      console.error(err)
      enqueued = (await persistForRetry(event, relays)) || enqueued
    }
  }

  if (enqueued) triggerJob(nostrEventPublisherJobName, { delay: 0 })

  async function persistForRetry (eventToQueue, relaysToQueue) {
    try {
      await idb.enqueueQueueEntry({
        type: 'nostr:event',
        event: eventToQueue,
        relays: relaysToQueue,
        context: 'account-bootstrap'
      })
      return true
    } catch (queueErr) {
      console.error(queueErr)
      return false
    }
  }
}

export {
  init
}
