function initHandlers () {
  const handlers = [
    'header',
    'home',
    'new-account',
    'add-account',
    'add-account-with-passkey',
    'add-account-with-nsec',
    'overlays'
    // 'lock'
  ]
  return Promise.all(handlers.map(v => import(`./${v}.js`)))
}

export {
  initHandlers
}
