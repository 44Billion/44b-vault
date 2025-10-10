import { router } from 'router'

function init () {
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

    router.goToRoute({ route })
    setTimeout(() => { btns.forEach(btn => { btn.disabled = false }) }, 300)
  })
}

export {
  init
}
