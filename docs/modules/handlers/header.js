import { router } from 'router'
import { getQueryParam } from 'helpers/misc.js'

function init () {
  router.addEventListener('routechange', () => {
    const page = getQueryParam('page') || '0'
    switch (page) {
      case '0': {
        document.getElementById('back-btn').classList.add('invisible')
        document.getElementById('info-btn').classList.remove('invisible')
        break
      }
      default: {
        document.getElementById('info-btn').classList.add('invisible')
        document.getElementById('back-btn').classList.remove('invisible')
      }
    }
  })

  const backBtn = document.getElementById('back-btn')
  backBtn.addEventListener('click', () => {
    backBtn.disabled = true
    router.goBack({ toRoot: !!history.state?.goBackConfig?.toRoot })
    setTimeout(() => { backBtn.disabled = false }, 300)
  })

  const infoBtn = document.getElementById('info-btn')
  infoBtn.addEventListener('click', () => {
    infoBtn.disabled = true
    const route = infoBtn.dataset.route
    router.goToRoute({ route })
    setTimeout(() => { infoBtn.disabled = false }, 300)
  })
}

export {
  init
}
