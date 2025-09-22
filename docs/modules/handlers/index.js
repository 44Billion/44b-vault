function initHandlers () {
  const handlers = [
    'header',
    'home',
    'new-account',
    // 'lock'
  ]
  return Promise.all(handlers.map(v => import(`./${v}.js`)))
}

export {
  initHandlers
}
