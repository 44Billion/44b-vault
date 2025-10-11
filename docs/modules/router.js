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
  '/add-account-with-passkey': {
    page: 2,
    stateKey: null
  },
  '/add-account-with-nsec': {
    page: 2,
    stateKey: null
  },
  '/backup-accounts': {
    page: 1,
    stateKey: null
  },
  '/permissions': {
    page: 1,
    stateKey: null
  },
  '/logout': {
    page: 1,
    stateKey: null
  },
  '/unlock-account': {
    page: 1,
    stateKey: null
  }
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
      // Update current route when using browser navigation
      if (state?.route) this.#currentRoute = state.route
      this.#emitRouteChangeEvent({ state })
    })
    this.addEventListener('routechange', this.#transitionPage.bind(this))
    // Listen for content changes that require dimension updates
    this.addEventListener('content-changed', this.#transitionPage.bind(this))
    this.updateState({ route: '/' })
  }

  #emitRouteChangeEvent (detail) {
    // Ensure we always have a route in the state
    if (!detail.state?.route) {
      const currentRoute = this.#getCurrentRoute()
      detail = {
        ...detail,
        state: {
          ...detail.state,
          route: currentRoute
        }
      }
      // Update current route when determined from DOM
      this.#currentRoute = currentRoute
    }
    this.dispatchEvent(new CustomEvent('routechange', { detail }))
  }

  #getCurrentRoute () {
    const page = getQueryParam('page') || 0
    const possibleRoutes = routesByPage[page] || ['/']

    // Find the visible route on the current page
    for (const route of possibleRoutes) {
      const element = document.getElementById(route)
      if (element && !element.classList.contains('invisible')) {
        return route
      }
    }

    // Default to first route of the page, or home
    return possibleRoutes[0] || '/'
  }

  #transitionPage () {
    const page = getQueryParam('page') || 0
    const oldHeight = document.getElementById('vault').getBoundingClientRect().height
    const nextViewElement = document.querySelector(`#page-${page} > div:not(.invisible)`)
    if (!nextViewElement) {
      console.warn('No visible element found for the current route:', this.#currentRoute)
      return
    }

    const nextViewHeight = nextViewElement.getBoundingClientRect().height
    const currentViewHeight = parseInt(document.getElementById('view').style.height.split('px')[0]) || 0
    const diffViewHeight = nextViewHeight - currentViewHeight
    changeDimensions({ height: oldHeight + diffViewHeight })

    document.getElementById('pages').style.transform = `translateX(-${page * 100}%)`
    if (nextViewHeight) document.getElementById('view').style.height = `${nextViewHeight}px`
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
  #currentRoute = '/'

  goToRoute ({ route, state, queryParams = {} }) {
    if (!(route in routes)) return
    if (route === '/') return this.goBack({ toRoot: true, state })
    if (route === this.#currentRoute) return

    const { page } = routes[route]
    const currentPage = getQueryParam('page') || 0
    if (parseInt(page) !== parseInt(currentPage)) this.#hopsFromRoot++

    state = { ...state, route }

    // Update the current route
    this.#currentRoute = route

    routesByPage[page].forEach(v => document.getElementById(v).classList[v === route ? 'remove' : 'add']('invisible'))
    queryParams = { ...queryParams, page }
    this.#pushState(state, '', `?${new URLSearchParams(queryParams)}`)
  }

  goBack ({ toRoot = false, state }) {
    if (this.#hopsFromRoot === 0) return

    const currentPage = getQueryParam('page')
    setTimeout(() => {
      if (currentPage === getQueryParam('page')) return
      document.querySelector(`#page-${currentPage} > div:not(.invisible)`).classList.add('invisible')
    }, 300) // transition duration

    const next = toRoot ? -this.#hopsFromRoot : -1
    this.#hopsFromRoot = this.#hopsFromRoot + next
    // Don't try to predict the route - let #getCurrentRoute determine it after navigation
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
