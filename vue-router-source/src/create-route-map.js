/* @flow */

import Regexp from 'path-to-regexp'
import { cleanPath } from './util/path'
import { assert, warn } from './util/warn'

export function createRouteMap(
  routes: Array<RouteConfig>,
  oldPathList?: Array<string>,
  oldPathMap?: Dictionary<RouteRecord>,
  oldNameMap?: Dictionary<RouteRecord>,
  parentRoute?: RouteRecord
): {
  pathList: Array<string>,
  pathMap: Dictionary<RouteRecord>,
  nameMap: Dictionary<RouteRecord>
} {
  // 若旧的路由相关映射列表及map存在，则使用旧的初始化（借此实现添加路由功能）
  const pathList: Array<string> = oldPathList || []
  // $flow-disable-line
  const pathMap: Dictionary<RouteRecord> = oldPathMap || Object.create(null)
  // $flow-disable-line
  const nameMap: Dictionary<RouteRecord> = oldNameMap || Object.create(null)

  // 递归处理路由记录，最终生成pathList-路径数组 其中有个为空，其实是/，在normalizePath时被删除了, pathMap-路径映射对象, nameMap-路由名字映射对象
  routes.forEach(route => {
    // 生成一个RouteRecord并更新pathList、pathMap和nameMap
    addRouteRecord(pathList, pathMap, nameMap, route, parentRoute)
  })

  // 确保通配符*路由始终位于末尾
  for (let i = 0, l = pathList.length; i < l; i++) {
    if (pathList[i] === '*') {
      pathList.push(pathList.splice(i, 1)[0])
      l--
      i--
    }
  }

  if (process.env.NODE_ENV === 'development') {
    // warn if routes do not include leading slashes
    const found = pathList
      // check for missing leading slash
      .filter(path => path && path.charAt(0) !== '*' && path.charAt(0) !== '/')

    if (found.length > 0) {
      const pathNames = found.map(path => `- ${path}`).join('\n')
      warn(false, `Non-nested routes must include a leading slash character. Fix the following routes: \n${pathNames}`)
    }
  }

  return {
    pathList,
    pathMap,
    nameMap
  }
}

// 添加路由记录，更新pathList、pathMap、nameMap
function addRouteRecord(
  pathList: Array<string>,
  pathMap: Dictionary<RouteRecord>,
  nameMap: Dictionary<RouteRecord>,
  route: RouteConfig,
  parent?: RouteRecord,
  matchAs?: string // 处理别名路由时使用
) {
  const { path, name } = route
  if (process.env.NODE_ENV !== 'production') {
    assert(path != null, `"path" is required in a route configuration.`)
    assert(
      typeof route.component !== 'string',
      `route config "component" for path: ${String(
        path || name
      )} cannot be a ` + `string id. Use an actual component instead.`
    )

    warn(
      // eslint-disable-next-line no-control-regex
      !/[^\u0000-\u007F]+/.test(path),
      `Route with path "${path}" contains unencoded characters, make sure ` +
      `your path is correctly encoded before passing it to the router. Use ` +
      `encodeURI to encode static segments of your path.`
    )
  }

  // 路径存储扩展选项
  const pathToRegexpOptions: PathToRegexpOptions =
    route.pathToRegexpOptions || {}

  // 生成格式化后的path(子路由会拼接上父路由的path)
  const normalizedPath = normalizePath(path, parent, pathToRegexpOptions.strict)

  // 匹配规则是否大小写敏感，默认值：false
  if (typeof route.caseSensitive === 'boolean') {
    pathToRegexpOptions.sensitive = route.caseSensitive
  }

  // 生成一条路由记录
  const record: RouteRecord = {
    path: normalizedPath, // 规范化后的路径
    regex: compileRouteRegex(normalizedPath, pathToRegexpOptions), // 利用path-to-regexp包生成用来匹配path的增强正则对象，用来匹配动态路由 （/a/:b）
    components: route.components || { default: route.component }, // 保存路由组件，支持命名视图https://router.vuejs.org/zh/guide/essentials/named-views.html#命名视图
    alias: route.alias // VueRouter支持给路由设置别名；/a 的别名是 /b，意味着，当用户访问 /b 时，URL 会保持为 /b，但是路由匹配则为 /a，就像用户访问 /a 一样
      ? typeof route.alias === 'string' // 支持单别名和多别名，统一转为数组
        ? [route.alias]
        : route.alias
      : [],
    instances: {}, // 保存router-view实例
    enteredCbs: {},
    name,
    parent, // 父路由记录
    matchAs, // 别名路由需要使用
    redirect: route.redirect, // 重定向的路由配置对象
    beforeEnter: route.beforeEnter, // 路由独享的守卫
    meta: route.meta || {}, // 元信息
    props: // 动态路由传参
      route.props == null
        ? {}
        : route.components // 命名视图的传参规则需要使用route.props指定的规则
          ? route.props
          : { default: route.props }
  }

  // 处理有子路由情况，递归
  if (route.children) {
    // Warn if route is named, does not redirect and has a default child route.
    // If users navigate to this route by name, the default child will
    // not be rendered (GH Issue #629)
    if (process.env.NODE_ENV !== 'production') {
      if (
        route.name &&
        !route.redirect &&
        route.children.some(child => /^\/?$/.test(child.path))
      ) {
        warn(
          false,
          `Named Route '${route.name}' has a default child route. ` +
          `When navigating to this named route (:to="{name: '${route.name
          }'"), ` +
          `the default child route will not be rendered. Remove the name from ` +
          `this route and use the name of the default child route for named ` +
          `links instead.`
        )
      }
    }
    // 遍历生成子路由记录
    route.children.forEach(child => {
      // matchAs若有值，代表当前路由是别名路由，则需要单独生成别名路由的子路由，路径前缀需使用matchAs
      const childMatchAs = matchAs
        ? cleanPath(`${matchAs}/${child.path}`)
        : undefined
      addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs)
    })
  }

  // 若pathMap中不存在当前路径，则更新pathList和pathMap
  if (!pathMap[record.path]) {
    pathList.push(record.path)
    pathMap[record.path] = record
  }

  // 处理别名
  if (route.alias !== undefined) {
    const aliases = Array.isArray(route.alias) ? route.alias : [route.alias] // alias支持string，和Array<String>
    for (let i = 0; i < aliases.length; ++i) {
      const alias = aliases[i]
      if (process.env.NODE_ENV !== 'production' && alias === path) {  // alias的值和path重复，需要给提示
        warn(
          false,
          `Found an alias with the same value as the path: "${path}". You have to remove that alias. It will be ignored in development.`
        )
        // skip in dev to make it work
        continue
      }

      // 生成别名路由配置对象
      const aliasRoute = {
        path: alias,
        children: route.children
      }
      // 添加别名路由记录
      addRouteRecord(
        pathList,
        pathMap,
        nameMap,
        aliasRoute, // 别名路由
        parent,// 当前路由的父路由，因为是给当前路由取了个别名，所以二者其实是有同个父路由的
        record.path || '/' // matchAs，用来生成别名路由的子路由
      )
      // 当前路由设置了alias后，会单独为当前路由及其所有子路由生成路由记录，且子路由的path前缀为matchAs(即别名路由的path)
    }
  }

  // 处理命名路由
  if (name) {
    // 更新nameMap，添加name映射对象
    if (!nameMap[name]) {
      nameMap[name] = record
    } else if (process.env.NODE_ENV !== 'production' && !matchAs) {
      // 路由重名警告
      warn(
        false,
        `Duplicate named routes definition: ` +
        `{ name: "${name}", path: "${record.path}" }`
      )
    }
  }
}

function compileRouteRegex(
  path: string,
  pathToRegexpOptions: PathToRegexpOptions
): RouteRegExp {
  // Regexp接收三个参数path，keys，options
  //  path为需要转换为正则的路径
  //  keys，是用来接收在path中找到的key，可以传入，也可以直接使用返回值上的keys属性
  //  options为选项
  const regex = Regexp(path, [], pathToRegexpOptions)
  if (process.env.NODE_ENV !== 'production') {
    const keys: any = Object.create(null)
    regex.keys.forEach(key => {
      // 重复key警告
      warn(
        !keys[key.name],
        `Duplicate param keys in route with path: "${path}"`
      )
      keys[key.name] = true
    })
  }
  return regex
}

// 规格化路径
function normalizePath(
  path: string,
  parent?: RouteRecord,
  strict?: boolean // 严格
): string {
  // 路径末尾有 / ，去掉
  if (!strict) path = path.replace(/\/$/, '')
  // 下标0为 / ，则是最外层path
  if (path[0] === '/') return path
  // 无父级，则是最外层path
  if (parent == null) return path
  // 清除path中双斜杆中的一个
  return cleanPath(`${parent.path}/${path}`)
}
