/* @flow */

import type VueRouter from '../index'
import { parsePath, resolvePath } from './path'
import { resolveQuery } from './query'
import { fillParams } from './params'
import { warn } from './warn'
import { extend } from './misc'

// 地址格式化，返回一个带有_normalized:true标识的Location类型的对象
export function normalizeLocation(
  raw: RawLocation, // 原始location，一个string，或者是一个已经格式化后的location
  current: ?Route, // 当前路由对象
  append: ?boolean, // 是否是追加模式，例如，我们从 /a 导航到一个相对路径 b，如果没有配置 append，则路径为 /b，如果配了，则为 /a/b
  router: ?VueRouter // VueRouter实例
): Location {
  // 将string类型的转换为对象形式，方便后面统一处理
  let next: Location = typeof raw === 'string' ? { path: raw } : raw

  // named target
  // 已经格式化过，直接返回
  if (next._normalized) {
    return next
  } else if (next.name) { // 判断是否是命名路由， 拷贝原始地址raw，拷贝params，直接返回
    // 处理命名路由，例如{name:'Home',params:{id:3}}
    next = extend({}, raw)
    const params = next.params
    if (params && typeof params === 'object') {
      next.params = extend({}, params)
    }
    return next
  }

  // 处理仅携带参数的相对路由(相对参数)跳转，如this.$router.push({params:{id:1}})
  // 没有path、仅有params并且当前路由对象存在
  if (!next.path && next.params && current) {
    next = extend({}, next)
    next._normalized = true

    // 提取当前route的字段做为next的字段，因为相对参数形式，只有params，必须借助current提取一些字段
    const params: any = extend(extend({}, current.params), next.params)

    if (current.name) { // 命名路由形式
      next.name = current.name
      next.params = params
    } else if (current.matched.length) { // 非命名路由即path形式，从匹配记录中提取出当前path并填充参数
      const rawPath = current.matched[current.matched.length - 1].path
      next.path = fillParams(rawPath, params, `path ${current.path}`)
    } else if (process.env.NODE_ENV !== 'production') {
      warn(false, `relative params navigation requires a current route.`)
    }
    return next
  }

  // 处理通过path跳转的方式
  // 调用parsePath从path中解析出path、query、hash
  const parsedPath = parsePath(next.path || '')
  // 然后以current.path为basePath，解析并resolve出最终path
  const basePath = (current && current.path) || '/'
  const path = parsedPath.path
    ? resolvePath(parsedPath.path, basePath, append || next.append)
    : basePath

  // 解析query
  const query = resolveQuery(
    parsedPath.query,
    next.query, // 额外需要追加的qs
    router && router.options.parseQuery // 支持传入自定义解析query的方法
  )

  // 解析hash
  let hash = next.hash || parsedPath.hash
  if (hash && hash.charAt(0) !== '#') {
    hash = `#${hash}`
  }

  return {
    _normalized: true, // 标识已经格式化过
    path,
    query,
    hash
  }
}
