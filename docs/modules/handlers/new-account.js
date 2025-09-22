import { getSvgAvatar } from 'avatar'
import { router } from 'router'

const createAccountBtn = document.querySelector('#\\/new-account button.create-account')
createAccountBtn.addEventListener('click', () => {
  createAccountBtn.disabled = true
  createAccountBtn.getElementsByClassName('t-create-account')[0].classList.add('pulsate')
})

const photoPickerBtn = document.querySelector('#\\/new-account button.photo-picker')
const avatarNode = photoPickerBtn.querySelector(':scope > div:first-child')
const avatarIcon = photoPickerBtn.getElementsByClassName('gg-girl')[0]
photoPickerBtn.addEventListener('click', async () => {
  photoPickerBtn.disabled = true
  const url = window.encodeURIComponent(await getSvgAvatar())
  avatarIcon.classList.add('invisible')
  avatarNode.style.backgroundImage = `url("data:image/svg+xml;charset=utf-8,${url}")`
  photoPickerBtn.disabled = false
})

const displayNameInput = document.getElementById('new-account-display-name')
function onUnmout() {
  createAccountBtn.disabled = false
  avatarIcon.classList.remove('invisible')
  avatarNode.style.backgroundImage = 'none'
  displayNameInput.value = ''
}
router.addEventListener('routechange', e => {
  if (e.detail.state.route !== '/new-account') return

  router.addEventListener('routechange', onUnmout, { once: true })
})
