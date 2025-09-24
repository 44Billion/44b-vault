import { getQueryParam } from 'helpers/misc.js'
import { changeDimensions } from 'messenger'

const routes = {
  '/': {
    page: 0,
    stateKey: null
  },
  '/info': {
    page: 1,
    stateKey: null
  },
  '/new-account': {
    page: 1,
    stateKey: null
  },
  '/add-account': {
    page: 1,
    stateKey: null
  },
  '/backup-accounts': {
    page: 1,
    stateKey: null
  },
  '/lock': {
    page: 1,
    stateKey: null
  },
  '/logout': {
    page: 1,
    stateKey: null
  },
}
const routesByPage = Object.entries(routes).reduce((r, [k, v]) => {
  r[v.page] ??= []
  r[v.page].push(k)
  return r
}, {})

class Router extends EventTarget {
  #nextState

  constructor () {
    super()
    // triggered on
    // - browser back/forward button
    // - history.back/forward/go()
    window.addEventListener('popstate', e => {
      // this allow us to "change" state on back/forward/go
      const state = this.#nextState !== undefined ? { route: e.state.route, ...this.#nextState } : e.state
      this.#emitRouteChangeEvent({ state })
    })
    this.addEventListener('routechange', this.#transitionPage.bind(this))
    this.updateState({ route: '/' })
  }

  #emitRouteChangeEvent (detail) {
    this.dispatchEvent(new CustomEvent("routechange", { detail }))
  }

  #transitionPage () {
    const page = getQueryParam('page') || 0
    const oldHeight = document.getElementById('vault').getBoundingClientRect().height
    const nextViewHeight = document.querySelector(`#page-${page} > div:not(.invisible)`).getBoundingClientRect().height
    const diffViewHeight = nextViewHeight - document.getElementById('view').style.height.split('px')[0]
    changeDimensions({ height: oldHeight + diffViewHeight })

    document.getElementById('pages').style.transform = `translateX(-${page * 100}%)`
    document.getElementById('view').style.height = `${nextViewHeight}px`
  }

  #pushState (...args) {
    history.pushState(...args)
    this.#emitRouteChangeEvent({ state: args[0] })
  }

  #go (steps, { state }) {
    if (state) {
      this.#nextState = state
      window.addEventListener('popstate', e => {
        this.#nextState = undefined
        this.updateState({ route: e.state.route, ...state })
      }, { once: true })
    }
    history.go(steps)
  }

  #hopsFromRoot = 0
  goToRoute ({ route, state, queryParams = {} }) {
    if (!(route in routes)) return
    if (route === '/') return this.goBack({ toRoot: true, state })

    state = { ...state, route }
    this.#hopsFromRoot++
    const { page } = routes[route]
    routesByPage[page].forEach(v => document.getElementById(v).classList[v === route ? 'remove' : 'add']('invisible'))
    queryParams = { ...queryParams, page }
    this.#pushState(state, '', `?${new URLSearchParams(queryParams)}`)
  }

  goBack ({ toRoot = false, state }) {
    if (this.#hopsFromRoot === 0) return

    const next = toRoot ? -this.#hopsFromRoot : -1
    this.#hopsFromRoot = this.#hopsFromRoot + next
    this.#go(next, { state })
  }

  // update history.state
  updateState (state) {
    history.replaceState(state, '', window.location.href)
  }
}

const router = new Router()
// example
// requestAnimationFrame(() => requestAnimationFrame(() => router.goToRoute({ route: '/new-account'})))

export {
  router
}
