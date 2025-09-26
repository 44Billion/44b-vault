function initHandlers () {
  const handlers = [
    'header',
    'home',
    'new-account',
    'add-account',
    'add-account-with-passkey',
    'overlays'
    // 'lock'
  ]
  return Promise.all(handlers.map(v => import(`./${v}.js`)))
}

export {
  initHandlers
}
