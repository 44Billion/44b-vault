import { router } from 'router'

function init () {
  const addAccountNode = document.getElementById('/add-account')
  addAccountNode.addEventListener('click', async e => {
    const btns = [...addAccountNode.querySelectorAll(':scope > button')]
    btns.forEach(btn => { btn.disabled = true })

    let btn
    let route
    if (
      !(btn = e.target.closest('button')) ||
      !addAccountNode.contains(btn) ||
      !(route = btn.dataset.route)
    ) return btns.forEach(btn => { btn.disabled = false })

    router.goToRoute({ route })
    setTimeout(() => { btns.forEach(btn => { btn.disabled = false }) }, 300)
  })
}

export {
  init
}
