/* @flow */

import { _Vue } from '../install'
import type Router from '../index'
import { inBrowser } from '../util/dom'
import { runQueue } from '../util/async'
import { warn } from '../util/warn'
import { START, isSameRoute, handleRouteEntered } from '../util/route'
import {
  flatten,
  flatMapComponents,
  resolveAsyncComponents
} from '../util/resolve-components'
import {
  createNavigationDuplicatedError,
  createNavigationCancelledError,
  createNavigationRedirectedError,
  createNavigationAbortedError,
  isError,
  isNavigationFailure,
  NavigationFailureType
} from '../util/errors'

// 三种模式父类
export class History {
  router: Router
  base: string
  current: Route
  pending: ?Route
  cb: (r: Route) => void
  ready: boolean
  readyCbs: Array<Function>
  readyErrorCbs: Array<Function>
  errorCbs: Array<Function>
  listeners: Array<Function>
  cleanupListeners: Function

  // implemented by sub-classes
  // 需要子类HTML5History、HashHistory实现的方法
  +go: (n: number) => void
  +push: (loc: RawLocation, onComplete?: Function, onAbort?: Function) => void
    +replace: (
      loc: RawLocation,
      onComplete?: Function,
      onAbort?: Function
    ) => void
      +ensureURL: (push?: boolean) => void
        +getCurrentLocation: () => string
          + setupListeners: Function

constructor(router: Router, base: ?string) {
  this.router = router
  // 格式化base，保证base是以/开头
  this.base = normalizeBase(base)
  // start with a route object that stands for "nowhere"
  // 当前指向的route对象，默认为START；即from
  this.current = START
  // 记录将要跳转的route；即to
  this.pending = null
  this.ready = false
  this.readyCbs = []
  this.readyErrorCbs = []
  this.errorCbs = []
  this.listeners = []
}

listen(cb: Function) {
  this.cb = cb
}

onReady(cb: Function, errorCb: ?Function) {
  if (this.ready) {
    cb()
  } else {
    this.readyCbs.push(cb)
    if (errorCb) {
      this.readyErrorCbs.push(errorCb)
    }
  }
}

onError(errorCb: Function) {
  this.errorCbs.push(errorCb)
}

// 路由跳转
transitionTo(
  location: RawLocation, // 原始location，一个url或者是一个Location interface(自定义形状，在types/router.d.ts中定义)
  onComplete ?: Function, // 跳转成功回调
  onAbort ?: Function // 跳转失败(取消)回调
) {
  let route
  // catch redirect option https://github.com/vuejs/vue-router/issues/3201
  try {
    // 传入需要跳转的location和当前路由对象，返回to的Route，即路由匹配过程
    route = this.router.match(location, this.current)
  } catch (e) {
    this.errorCbs.forEach(cb => {
      cb(e)
    })
    // Exception should still be thrown
    throw e
  }
  const prev = this.current
  // 确认跳转
  this.confirmTransition(
    route,
    () => {// onComplete，完成
      // 更新route，触发afterEach钩子，触发重新渲染
      this.updateRoute(route)
      // 调用onComplete回调
      onComplete && onComplete(route)
      this.ensureURL()

      // 触发afterEach钩子
      this.router.afterHooks.forEach(hook => {
        hook && hook(route, prev)
      })

      // fire ready cbs once
      // 触发ready回调
      if (!this.ready) {
        this.ready = true
        this.readyCbs.forEach(cb => {
          cb(route)
        })
      }
    },
    err => { // onAbort，失败(取消)
      if (onAbort) {
        onAbort(err)
      }
      if (err && !this.ready) {
        // Initial redirection should not mark the history as ready yet
        // because it's triggered by the redirection instead
        // https://github.com/vuejs/vue-router/issues/3225
        // https://github.com/vuejs/vue-router/issues/3331
        if (!isNavigationFailure(err, NavigationFailureType.redirected) || prev !== START) {
          this.ready = true
          this.readyErrorCbs.forEach(cb => {
            cb(err)
          })
        }
      }
    }
  )
}

// 确认路由跳转
confirmTransition(route: Route, onComplete: Function, onAbort ?: Function) {
  const current = this.current
  // 记录将要跳转的route，方便取消对比用
  this.pending = route
  // 取消
  const abort = err => {
    // changed after adding errors with
    // https://github.com/vuejs/vue-router/pull/3047 before that change,
    // redirect and aborted navigation would produce an err == null
    if (!isNavigationFailure(err) && isError(err)) {
      if (this.errorCbs.length) {
        this.errorCbs.forEach(cb => {
          cb(err)
        })
      } else {
        warn(false, 'uncaught error during route navigation:')
        console.error(err)
      }
    }
    onAbort && onAbort(err)
  }
  const lastRouteIndex = route.matched.length - 1
  const lastCurrentIndex = current.matched.length - 1
  if (
    isSameRoute(route, current) && // 判断是否相同route，重复跳转
    // in the case the route map has been dynamically appended to
    // 防止route map 被动态改变
    lastRouteIndex === lastCurrentIndex &&
    route.matched[lastRouteIndex] === current.matched[lastCurrentIndex]
  ) {
    // ensureURL由子类实现，主要根据传参确定是添加还是替换一个记录
    this.ensureURL()
    return abort(createNavigationDuplicatedError(current, route))
  }

  // 对比前后route的RouteRecord，找出需要更新、失活、激活的的路由记录
  const { updated, deactivated, activated } = resolveQueue(
    this.current.matched,
    route.matched
  )

  // 生成需要执行的守卫、钩子队列
  const queue: Array<?NavigationGuard> = [].concat(
    // in-component leave guards
    // 提取路由组件中所有beforeRouteLeave守卫
    extractLeaveGuards(deactivated),
    // global before hooks
    // 全局的beforeEach守卫
    this.router.beforeHooks,
    // in-component update hooks
    // 提取路由组件中所有beforeRouteUpdate守卫
    extractUpdateHooks(updated),
    // in-config enter guards
    // 路由独享的beforeEnter守卫
    activated.map(m => m.beforeEnter),
    // async components
    // 解析异步组件
    resolveAsyncComponents(activated)
  )

  // 迭代函数
  const iterator = (hook: NavigationGuard, next) => {
    if (this.pending !== route) {
      // 当发现to发生变化，则代表需要取消
      return abort(createNavigationCancelledError(current, route))
    }
    try {
      hook(route, current, (to: any) => {
        if (to === false) {
          // next(false) -> abort navigation, ensure current URL
          // next(false) -> 取消跳转，添加一个新历史记录(但由于url地址未发生变化，所以并未添加记录)
          this.ensureURL(true)
          abort(createNavigationAbortedError(current, route))
        } else if (isError(to)) {
          this.ensureURL(true)
          abort(to)
        } else if (
          typeof to === 'string' || // next('/')
          (typeof to === 'object' &&
            (typeof to.path === 'string' || typeof to.name === 'string')) // next({path:'/'})或next({name:'Home'})
        ) {
          // next('/') or next({ path: '/' }) -> redirect
          abort(createNavigationRedirectedError(current, route))
          if (typeof to === 'object' && to.replace) {
            // 调用子类方法的替换记录
            this.replace(to)
          } else {
            // 调用子类方法的添加记录
            this.push(to)
          }
        } else {
          // confirm transition and pass on the value
          // next()
          next(to)
        }
      })
    } catch (e) {
      abort(e)
    }
  }

  // 执行队列
  runQueue(queue, iterator, () => {
    // wait until async components are resolved before
    // extracting in-component enter guards
    const enterGuards = extractEnterGuards(activated)
    const queue = enterGuards.concat(this.router.resolveHooks)
    runQueue(queue, iterator, () => {
      if (this.pending !== route) {
        return abort(createNavigationCancelledError(current, route))
      }
      this.pending = null
      // 执行onComplete回调，onComplete中会调用updateRoute方法，内部会触发afterEach钩子
      onComplete(route)
      if (this.router.app) {
        this.router.app.$nextTick(() => {
          handleRouteEntered(route)
        })
      }
    })
  })
}

// 更新路由
updateRoute(route: Route) {
  // 更新current
  this.current = route
  // 调用updateRoute回调，回调中会重新为_routerRoot._route赋值，进而触发router-view的重新渲染
  this.cb && this.cb(route)
}

setupListeners() {
  // Default implementation is empty
}

teardown() {
  // clean up event listeners
  // https://github.com/vuejs/vue-router/issues/2341
  this.listeners.forEach(cleanupListener => {
    cleanupListener()
  })
  this.listeners = []

  // reset current history route
  // https://github.com/vuejs/vue-router/issues/3294
  this.current = START
  this.pending = null
}
}

// 格式化base，保证base是以/开头
function normalizeBase(base: ?string): string {
  if (!base) {
    if (inBrowser) {
      // respect <base> tag
      const baseEl = document.querySelector('base')
      base = (baseEl && baseEl.getAttribute('href')) || '/'
      // strip full URL origin
      base = base.replace(/^https?:\/\/[^\/]+/, '')
    } else {
      base = '/'
    }
  }
  // make sure there's the starting slash
  if (base.charAt(0) !== '/') {
    base = '/' + base
  }
  // remove trailing slash
  return base.replace(/\/$/, '')
}

// 对比curren、next的路由记录列表，找出需要更新、失活、激活的路由记录
function resolveQueue(
  current: Array<RouteRecord>,
  next: Array<RouteRecord>
): {
  updated: Array<RouteRecord>,
  activated: Array<RouteRecord>,
  deactivated: Array<RouteRecord>
} {
  let i
  // 找到首个不相等的路由记录索引
  const max = Math.max(current.length, next.length)
  for (i = 0; i < max; i++) {
    if (current[i] !== next[i]) {
      break
    }
  }

  return {
    updated: next.slice(0, i), // 索引左侧需要更新
    activated: next.slice(i), // 索引右侧需要激活
    deactivated: current.slice(i) // 当前索引右侧是需要失活
  }
}

// 提取守卫
function extractGuards(
  records: Array<RouteRecord>,
  name: string, // 要提取的守卫名
  bind: Function, // 绑定守卫上下文函数
  reverse?: boolean // 是否需要逆序
): Array<?Function> {
  // def 路由组件定义
  // instance router-view实例
  // match 路由记录
  // key 视图名
  const guards = flatMapComponents(records, (def, instance, match, key) => {
    // 提取出路由组件中的守卫函数 
    // 为守卫绑定上下文
    const guard = extractGuard(def, name)
    if (guard) {
      return Array.isArray(guard)
        ? guard.map(guard => bind(guard, instance, match, key))
        : bind(guard, instance, match, key)
    }
  })
  // 扁平化 + 逆序
  return flatten(reverse ? guards.reverse() : guards)
}

// 提取单个守卫
function extractGuard(
  def: Object | Function,
  key: string
): NavigationGuard | Array<NavigationGuard> {
  if (typeof def !== 'function') {
    // extend now so that global mixins are applied.
    def = _Vue.extend(def)
  }
  return def.options[key]
}

// 传入路由记录列表，提取出beforeRouteLeave守卫并逆序输出
function extractLeaveGuards(deactivated: Array<RouteRecord>): Array<?Function> {
  return extractGuards(deactivated, 'beforeRouteLeave', bindGuard, true)
}

// 传入路由记录列表，提取出beforeRouteUpdate钩子
function extractUpdateHooks(updated: Array<RouteRecord>): Array<?Function> {
  return extractGuards(updated, 'beforeRouteUpdate', bindGuard)
}

// 将守卫的上下文绑定到vue实例(路由组件)
function bindGuard(guard: NavigationGuard, instance: ?_Vue): ?NavigationGuard {
  if (instance) {
    // 已经绑定过上下文的守卫函数
    return function boundRouteGuard() {
      return guard.apply(instance, arguments)
    }
  }
}

// 提取组件的beforeRouteEnter守卫
function extractEnterGuards(
  activated: Array<RouteRecord>
): Array<?Function> {
  return extractGuards(
    activated,
    'beforeRouteEnter',
    (guard, _, match, key) => { // 绑定beforeRouteEnter的执行上下文
      return bindEnterGuard(guard, match, key)
    }
  )
}

// 绑定beforeRouteEnter的执行上下文
function bindEnterGuard(
  guard: NavigationGuard,
  match: RouteRecord,
  key: string
): NavigationGuard {
  // 对组件内的beforeRouteEnter进行了包装
  return function routeEnterGuard(to, from, next) {
    // 调用组件内beforeRouteEnter守卫
    return guard(to, from, cb => {
      if (typeof cb === 'function') {
        if (!match.enteredCbs[key]) {
          match.enteredCbs[key] = []
        }
        match.enteredCbs[key].push(cb)
      }
      next(cb)
    })
  }
}
