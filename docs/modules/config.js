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
  config.isDev = ['127.0.0.1', 'localhost'].includes(window.location.hostname) &&
    !!document.querySelector(
      'head > script[src="/___vscode_livepreview_injected_script"]'
    )
  // reset to index.html without query string nor URI fragments
  history.replaceState(undefined, '', window.location.origin + window.location.pathname)
}

export {
  config,
  initConfig,
  languages
}
