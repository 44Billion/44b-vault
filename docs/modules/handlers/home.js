import { router } from 'router'
import { lockSession } from 'session-manager'
import idb from 'idb'

const homeNode = document.getElementById('/')
homeNode.addEventListener('click', async e => {
  const btns = [...homeNode.querySelectorAll(':scope > button:not(#update-vault-btn)')]
  btns.forEach(btn => { btn.disabled = true })

  let btn
  let route
  if (
    !(btn = e.target.closest('button')) ||
    !homeNode.contains(btn) ||
    !(route = btn.dataset.route)
  ) return btns.forEach(btn => { btn.disabled = false })

  let wasHandledInPlace
  if (btn.dataset.route === '/lock') {
    wasHandledInPlace = await maybeHandleLockBtnWithoutRouteChange()
  }
  if (!wasHandledInPlace) router.goToRoute({ route })
  setTimeout(() => { btns.forEach(btn => { btn.disabled = false }) }, 300)
})

async function maybeHandleLockBtnWithoutRouteChange () {
  const hasntLockedBefore = !(await idb.hasCurrentSessionEverBeenLocked())
  if (hasntLockedBefore) return false

  lockSession()
  return true
}
