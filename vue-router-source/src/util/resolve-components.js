/* @flow */

import { _Vue } from '../install'
import { warn } from './warn'
import { isError } from '../util/errors'

// 解析异步组件，返回一个接收to, from, next参数的函数
export function resolveAsyncComponents(matched: Array<RouteRecord>): Function {
  return (to, from, next) => {
    let hasAsync = false
    let pending = 0
    let error = null

    // def 路由组件定义
    // _ router-view实例,
    // match 路由记录
    // key 视图名
    flatMapComponents(matched, (def, _, match, key) => {
      // if it's a function and doesn't have cid attached,
      // assume it's an async component resolve function.
      // we are not using Vue's default async resolving mechanism because
      // we want to halt the navigation until the incoming component has been
      // resolved.
      // def.cid为实例构造函数标识；https://github.com/vuejs/vue/search?q=cid&unscoped_q=cid
      // 组件的定义是函数且组件cid还未设置，则认为其是一个异步组件
      if (typeof def === 'function' && def.cid === undefined) {
        hasAsync = true
        pending++

        const resolve = once(resolvedDef => {
          // 加载后的组件定义是一个esm
          if (isESModule(resolvedDef)) {
            resolvedDef = resolvedDef.default
          }
          // save resolved on async factory in case it's used elsewhere
          // 保留异步组件工厂函数，方便后续使用
          def.resolved = typeof resolvedDef === 'function'
            ? resolvedDef
            : _Vue.extend(resolvedDef)

          // 替换路由记录的命名视图中的组件
          match.components[key] = resolvedDef

          pending--

          if (pending <= 0) {
            // 所有异步组件加载完
            next()
          }
        })

        const reject = once(reason => {
          const msg = `Failed to resolve async component ${key}: ${reason}`
          process.env.NODE_ENV !== 'production' && warn(false, msg)
          if (!error) {
            error = isError(reason)
              ? reason
              : new Error(msg)
            next(error)
          }
        })

        let res
        try {
          // 返回promise
          res = def(resolve, reject)
        } catch (e) {
          reject(e)
        }
        if (res) {
          if (typeof res.then === 'function') {
            res.then(resolve, reject)
          } else {
            // new syntax in Vue 2.3
            // 处理加载状态，返回一个包对象；https://cn.vuejs.org/v2/guide/components-dynamic-async.html#处理加载状态
            // 通过import()加载，返回promise
            const comp = res.component
            if (comp && typeof comp.then === 'function') {
              comp.then(resolve, reject)
            }
          }
        }
      }
    })

    // 没有异步组件，直接next
    if (!hasAsync) next()
  }
}

// 扁平化路由记录中的路由组件
export function flatMapComponents(
  matched: Array<RouteRecord>, // 路由记录数组
  fn: Function // 回调函数
): Array<?Function> {
  return flatten(matched.map(m => {
    return Object.keys(m.components).map(key => fn(
      m.components[key], // 命名视图对应的路由组件定义；一般对应fn的入参def
      m.instances[key], // router-view实例；一般对应fn的入参_或instance
      m, // 匹配的路由记录；一般对应fn的入参match
      key // 命名视图的key；一般对应fn的入参key
    ))
  }))
}

export function flatten(arr: Array<any>): Array<any> {
  return Array.prototype.concat.apply([], arr)
}

const hasSymbol =
  typeof Symbol === 'function' &&
  typeof Symbol.toStringTag === 'symbol'

function isESModule(obj) {
  return obj.__esModule || (hasSymbol && obj[Symbol.toStringTag] === 'Module')
}

// in Webpack 2, require.ensure now also returns a Promise
// so the resolve/reject functions may get called an extra time
// if the user uses an arrow function shorthand that happens to
// return that Promise.
function once(fn) {
  let called = false
  return function (...args) {
    if (called) return
    called = true
    return fn.apply(this, args)
  }
}
