import { getSvgAvatar } from 'avatar'
import { router } from 'router'
import { reauthenticateWithPasskey } from 'passkey-manager'
import NostrSigner from 'nostr-signer'
import idb from 'idb'
import { showSuccessOverlay, showErrorOverlay, getQueryParam } from 'helpers/misc.js'
import { t } from 'translator'
import { setAccountsState } from 'messenger'

let currentAccount = null
let userPk = null
let overlayAbortController = null
let unlockReqId = 0

function init () {
  const unlockAccountBtn = document.querySelector('#\\/unlock-account button.unlock-account')
  const accountPictureElement = document.getElementById('unlock-account-picture')

  unlockAccountBtn.addEventListener('click', async () => {
    unlockAccountBtn.disabled = true

    overlayAbortController = new AbortController()
    const currentUnlockReqId = unlockReqId
    try {
      if (!currentAccount || !userPk) {
        throw new Error(t({ key: 'accountOrUserPubkeyNotFound' }))
      }

      // Reauthenticate with passkey
      const { success, privkey } = await reauthenticateWithPasskey(userPk, currentAccount.passkeyRawId)

      if (!success || !privkey) {
        if (currentUnlockReqId !== unlockReqId) return
        throw new Error(t({ key: 'authenticationFailed' }))
      }

      // Instantiate the nostr signer to unlock access
      NostrSigner.getOrCreate(privkey)
      await setAccountsState() // update isLocked info

      showSuccessOverlay(t({ key: 'accountUnlockedSuccessfully' }))
    } catch (err) {
      if (currentUnlockReqId !== unlockReqId) return
      console.log(err)
      showErrorOverlay(t({ key: 'unlockAccountError' }))
    } finally {
      unlockAccountBtn.disabled = false
    }
  })

  function onUnmount () {
    currentAccount = null
    userPk = null
    unlockAccountBtn.disabled = false
    accountPictureElement.style.backgroundImage = 'none'
    overlayAbortController?.abort()
  }

  router.addEventListener('routechange', async e => {
    if (e.detail.state.route !== '/unlock-account') return

    ++unlockReqId
    // Get userPk from query parameter
    userPk = getQueryParam('userPk')
    if (!userPk) {
      showErrorOverlay(t({ key: 'unlockAccountError' }), t({ key: 'userPubkeyNotProvided' }))
      return
    }

    try {
      // Get account from idb
      currentAccount = await idb.getAccountByPubkey(userPk)
      if (!currentAccount) {
        showErrorOverlay(t({ key: 'unlockAccountError' }), t({ key: 'accountNotFound' }))
        return
      }

      // Set account picture or fallback to avatar
      if (currentAccount.profile?.picture) {
        accountPictureElement.style.backgroundImage = `url("${currentAccount.profile.picture}")`
      } else {
        const avatarUrl = await getSvgAvatar(userPk)
        accountPictureElement.style.backgroundImage = `url("${avatarUrl}")`
      }
    } catch (err) {
      showErrorOverlay(t({ key: 'unlockAccountError' }), err.message)
    }

    // Set up cleanup
    router.addEventListener('routechange', onUnmount, { once: true })
  })
}

export {
  init
}
