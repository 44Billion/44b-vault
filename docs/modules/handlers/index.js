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
    'logout'
    // 'lock'
  ]
  return Promise.all(handlers.map(v => import(`./${v}.js`)))
}

export {
  initHandlers
}
