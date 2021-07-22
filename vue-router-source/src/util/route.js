/* @flow */

import type VueRouter from '../index'
import { stringifyQuery } from './query'

const trailingSlashRE = /\/?$/

// 生成正常Route
export function createRoute(
  record: ?RouteRecord,
  location: Location,
  redirectedFrom?: ?Location,
  router?: VueRouter
): Route {
  // 支持传入自定义序列化qs方法
  const stringifyQuery = router && router.options.stringifyQuery

  let query: any = location.query || {}
  try {
    // location.query为引用值，避免相互影响，进行深拷贝
    query = clone(query)
  } catch (e) { }

  // 生成Route
  const route: Route = {
    name: location.name || (record && record.name),
    meta: (record && record.meta) || {},
    path: location.path || '/',
    hash: location.hash || '',
    query,
    params: location.params || {},
    // getFullPath 在path后面追加了qs和hash，获取完整path
    fullPath: getFullPath(location, stringifyQuery),
    // formatMatch 获取所有关联的路由记录
    // 因为存在嵌套路由的情况，当子路由记录被匹配到时，其实代表着父路由记录也一定被匹配到了
    // /foo/bar 匹配了，则其父路由对象 /foo 肯定也匹配了，最终匹配结果如下
    // metched = [{path:"/foo", ...},{path:"/foo/bar", ...}]
    matched: record ? formatMatch(record) : []
  }

  // 如果是从其它路由对重定向过来的，需要记录重定向之前的地址
  if (redirectedFrom) {
    route.redirectedFrom = getFullPath(redirectedFrom, stringifyQuery)
  }

  // 冻结新Route 对象，防止篡改
  return Object.freeze(route)
}

function clone(value) {
  if (Array.isArray(value)) {
    return value.map(clone)
  } else if (value && typeof value === 'object') {
    const res = {}
    for (const key in value) {
      res[key] = clone(value[key])
    }
    return res
  } else {
    return value
  }
}

// the starting route that represents the initial state
// 初始状态的起始路由
export const START = createRoute(null, {
  path: '/'
})

// 获取所有关联的路由记录
// 因为存在嵌套路由的情况，当子路由记录被匹配到时，其实代表着父路由记录也一定被匹配到了
// /foo/bar 匹配了，则其父路由对象 /foo 肯定也匹配了，最终匹配结果如下
// metched = [{path:"/foo", ...},{path:"/foo/bar", ...}]
function formatMatch(record: ?RouteRecord): Array<RouteRecord> {
  const res = []
  while (record) {
    // 队列头添加，所以父record永远在前面，当前record永远在最后；在router-view组件中获取匹配的route record时会用到
    // 精准匹配到路由记录是数组最后一个
    res.unshift(record)
    record = record.parent
  }
  return res
}

// 在path后面追加了qs和hash，获取完整path 
function getFullPath(
  { path, query = {}, hash = '' },
  _stringifyQuery
): string {
  const stringify = _stringifyQuery || stringifyQuery
  return (path || '/') + stringify(query) + hash
}

// 判断是否相同route，重复跳转
export function isSameRoute(a: Route, b: ?Route, onlyPath: ?boolean): boolean {
  if (b === START) {
    return a === b
  } else if (!b) {
    return false
  } else if (a.path && b.path) {
    // path都存在，比较path、hash、query是否相同
    return a.path.replace(trailingSlashRE, '') === b.path.replace(trailingSlashRE, '') && (onlyPath ||
      a.hash === b.hash &&
      isObjectEqual(a.query, b.query))
  } else if (a.name && b.name) {
    // name都存在，比较name、hash、query、params是否相同
    return (
      a.name === b.name &&
      (onlyPath || (
        a.hash === b.hash &&
        isObjectEqual(a.query, b.query) &&
        isObjectEqual(a.params, b.params))
      )
    )
  } else {
    return false
  }
}

function isObjectEqual(a = {}, b = {}): boolean {
  // handle null value #1566
  if (!a || !b) return a === b
  const aKeys = Object.keys(a).sort()
  const bKeys = Object.keys(b).sort()
  if (aKeys.length !== bKeys.length) {
    return false
  }
  return aKeys.every((key, i) => {
    const aVal = a[key]
    const bKey = bKeys[i]
    if (bKey !== key) return false
    const bVal = b[key]
    // query values can be null and undefined
    if (aVal == null || bVal == null) return aVal === bVal
    // check nested equality
    if (typeof aVal === 'object' && typeof bVal === 'object') {
      return isObjectEqual(aVal, bVal)
    }
    return String(aVal) === String(bVal)
  })
}

export function isIncludedRoute(current: Route, target: Route): boolean {
  return (
    current.path.replace(trailingSlashRE, '/').indexOf(
      target.path.replace(trailingSlashRE, '/')
    ) === 0 &&
    (!target.hash || current.hash === target.hash) &&
    queryIncludes(current.query, target.query)
  )
}

function queryIncludes(current: Dictionary<string>, target: Dictionary<string>): boolean {
  for (const key in target) {
    if (!(key in current)) {
      return false
    }
  }
  return true
}

export function handleRouteEntered(route: Route) {
  for (let i = 0; i < route.matched.length; i++) {
    const record = route.matched[i]
    for (const name in record.instances) {
      const instance = record.instances[name]
      const cbs = record.enteredCbs[name]
      if (!instance || !cbs) continue
      delete record.enteredCbs[name]
      for (let i = 0; i < cbs.length; i++) {
        if (!instance._isBeingDestroyed) cbs[i](instance)
      }
    }
  }
}
