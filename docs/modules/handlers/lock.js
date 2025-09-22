import idb from 'idb'
import { router } from 'router'
import { storeNewSessionPrivkeyInSecureElement } from 'passkey-manager'
import { generatePrivateKey, getPublicKey } from 'nostr'

const lockBtn = document.querySelector('#\\/lock button.lock')
lockBtn.addEventListener('click', onButtonClick)

function disableButton () {
  lockBtn.disabled = true
  lockBtn.getElementsByClassName('t-lock')[0].classList.add('pulsate')
}

function enableButton () {
  lockBtn.disabled = false
  lockBtn.getElementsByClassName('t-lock')[0].classList.remove('pulsate')
}

async function onButtonClick () {
  disableButton()

  if (await idb.hasCurrentSessionEverBeenLocked()) {
    setTimeout(enableButton, 300)
    return router.goBack()
  }

  try {
    const currentSession = await idb.getCurrentSession()
    const sessionPrivkey = generatePrivateKey()
    const sessionPubkey = getPublicKey(sessionPrivkey)
    const sessionName = document.getElementById('new-session-input').value
    if (!sessionName?.trim?.()) throw new Error()

    // Up until now, the currentSession had no privkey set.
    // We record it on Secure Element and later below
    // we set it to currentSession
    const { response } = await storeNewSessionPrivkeyInSecureElement({ sessionPrivkey, sessionName })
    // May be useful in the future - https://developer.mozilla.org/en-US/docs/Web/API/AuthenticatorAttestationResponse/getPublicKey
    const passkeyPubkey = response.getPublicKey() // => ArrayBuffer
    const passkeyAlgoId = response.getPublicKeyAlgorithm()

    // Create session (at 'sessions' store)
    // before setting .privkey to current session,
    // cause some of these fields can't be recovered
    // from a idb.updatePendingCurrentSessionAssociations call
    // on init
    //
    // Setting .eAccountPubkeys will be deferred to idb.updatePendingCurrentSessionAssociations()
    // to avoid creating a time window big enough where user could close tab
    await idb.updatedSession({
      // it makes no sense to store it, cause only the user can change it and we wouldn't know?
      // or would us know on .get?
      name: sessionName,
      passkeyPubkey,
      passkeyAlgoId,
      pubkey: sessionPubkey
    })
    await idb.updateCurrentSession({
      ...currentSession,
      privkey: sessionPrivkey,
      pendingAssociationUpdateFields: {
        ...currentSession.pendingAssociationUpdateFields,
        accountPubkeys: true
      }
    })
    await idb.updatePendingCurrentSessionAssociations(currentSession)

    setTimeout(() => {
      document.getElementById('new-session-input').value = ''
      enableButton()
    }, 300)
    return router.goBack()
  } catch (err) {
    console.log(err.stack)
    enableButton()
  }
}
