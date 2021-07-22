/* @flow */

import type Router from '../index'
import { History } from './base'
import { cleanPath } from '../util/path'
import { getLocation } from './html5'
import { setupScroll, handleScroll } from '../util/scroll'
import { pushState, replaceState, supportsPushState } from '../util/push-state'

export class HashHistory extends History {
  constructor(router: Router, base: ?string, fallback: boolean) {
    // 继承父类
    super(router, base)
    // check history fallback deeplinking
    // fallback只有在指明了mode为history，但浏览器又不支持popstate，且用户手动指明了fallback为true时，才为true，其它情况为false
    // 如果需要回退，则会将url换为hash模式，即url添加上#，由checkFallback实现
    // this.base来自父类
    if (fallback && checkFallback(this.base)) {
      return
    }
    // 如果不是fallback，则直接调用ensureSlash，确保url是以/开头的
    ensureSlash()
  }

  // this is delayed until the app mounts
  // to avoid the hashchange listener being fired too early
  setupListeners() {
    if (this.listeners.length > 0) {
      return
    }

    const router = this.router
    const expectScroll = router.options.scrollBehavior
    const supportsScroll = supportsPushState && expectScroll

    // 若支持scroll,初始化scroll相关逻辑
    if (supportsScroll) {
      this.listeners.push(setupScroll())
    }

    const handleRoutingEvent = () => {
      const current = this.current
      if (!ensureSlash()) {
        return
      }
      this.transitionTo(getHash(), route => {
        if (supportsScroll) {
          handleScroll(this.router, route, current, true)
        }
        if (!supportsPushState) {
          replaceHash(route.fullPath)
        }
      })
    }

    // 即使是HashHistory也会优先使用popstate事件来监听url的变化
    const eventType = supportsPushState ? 'popstate' : 'hashchange'
    window.addEventListener(
      eventType,
      handleRoutingEvent
    )
    this.listeners.push(() => {
      window.removeEventListener(eventType, handleRoutingEvent)
    })
  }

  push(location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    this.transitionTo(
      location,
      route => {
        pushHash(route.fullPath)
        handleScroll(this.router, route, fromRoute, false)
        onComplete && onComplete(route)
      },
      onAbort
    )
  }

  replace(location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    this.transitionTo(
      location,
      route => {
        replaceHash(route.fullPath)
        handleScroll(this.router, route, fromRoute, false)
        onComplete && onComplete(route)
      },
      onAbort
    )
  }

  go(n: number) {
    window.history.go(n)
  }

  ensureURL(push?: boolean) {
    const current = this.current.fullPath
    if (getHash() !== current) {
      push ? pushHash(current) : replaceHash(current)
    }
  }

  getCurrentLocation() {
    return getHash()
  }
}

// 检查回退，将url转换为hash模式(添加/#)
function checkFallback(base) {
  const location = getLocation(base)
  // 匹配地址不以/#开头，则添加
  if (!/^\/#/.test(location)) {
    // url替换
    window.location.replace(cleanPath(base + '/#' + location))
    return true
  }
}

// 确保url是以/开头
function ensureSlash(): boolean {
  const path = getHash()
  if (path.charAt(0) === '/') {
    return true
  }
  // 替换hash记录
  replaceHash('/' + path)
  return false
}

export function getHash(): string {
  // We can't use window.location.hash here because it's not
  // consistent across browsers - Firefox will pre-decode it!
  let href = window.location.href
  const index = href.indexOf('#')
  // empty path
  if (index < 0) return ''

  href = href.slice(index + 1)

  return href
}

function getUrl(path) {
  const href = window.location.href
  const i = href.indexOf('#')
  const base = i >= 0 ? href.slice(0, i) : href
  return `${base}#${path}`
}

function pushHash(path) {
  if (supportsPushState) {
    pushState(getUrl(path))
  } else {
    window.location.hash = path
  }
}

// 替换hash记录
function replaceHash(path) {
  // 支持pushState，则优先使用replaceState，否则直接window.location.replace
  if (supportsPushState) {
    replaceState(getUrl(path))
  } else {
    window.location.replace(getUrl(path))
  }
}
