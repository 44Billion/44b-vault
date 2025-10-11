import { hideSuccessOverlay, hideErrorOverlay } from 'helpers/misc.js'
import { router } from 'router'
import { closeVaultView } from 'messenger'

function init () {
  document.getElementById('success-overlay').querySelector('button').addEventListener('click', closeVaultView)

  // Success overlay dismiss buttons (for all pages)
  const successDismissBtns = document.querySelectorAll('.success-dismiss')
  successDismissBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      hideSuccessOverlay()
      router.goBack({ toRoot: true })
    })
  })

  // Error overlay dismiss buttons (for all pages)
  const errorDismissBtns = document.querySelectorAll('.error-dismiss')
  errorDismissBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      hideErrorOverlay()
    })
  })
}

export {
  init
}
