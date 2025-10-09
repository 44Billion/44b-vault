function initHandlers () {
  const handlers = [
    'header',
    'home',
    'new-account',
    'add-account',
    'add-account-with-passkey',
    'add-account-with-nsec',
    'overlays',
    'authenticator-overlay',
    'backup-accounts',
    'logout',
    'unlock-account'
  ]
  return Promise.all(handlers.map(v => import(`./${v}.js`)))
}

export {
  initHandlers
}
