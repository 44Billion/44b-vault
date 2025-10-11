import { getQueryParam } from 'helpers/misc.js'

const languages = {
  en: true,
  pt: true
}
const deviceLanguage = (deviceLang => {
  deviceLang = (Intl.DateTimeFormat().resolvedOptions().locale || '').slice(0, 2)
  return languages[deviceLang] ? deviceLang : 'en'
})()

let config
function initConfig () {
  config = [
    ['lang', deviceLanguage], // en|pt
    ['mode', 'widget']
  ]
    .map(([k, d]) => [k, getQueryParam(k) || d])
    .reduce((r, [k, v]) => ({ ...r, [k]: v }), {})
  config.isDev = [
    'vault.localhost', // 44billion dev server
    'localhost', // 44b-vault dev server
    '127.0.0.1' // vscode live preview
  ].includes(window.location.hostname)

  // reset to index.html without query string nor URI fragments
  history.replaceState(undefined, '', window.location.origin + window.location.pathname)
}

export {
  config,
  initConfig,
  languages
}
