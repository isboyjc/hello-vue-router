/* @flow */

import { warn } from './warn'
import Regexp from 'path-to-regexp'

// $flow-disable-line
// 缓存
const regexpCompileCache: {
  [key: string]: Function
} = Object.create(null)

// 填充动态路由参数
export function fillParams(
  path: string,
  params: ?Object,
  routeMsg: string
): string {
  params = params || {}
  try {
    // compile主要用来逆解析，https://www.npmjs.com/package/path-to-regexp#compile-reverse-path-to-regexp
    //  例如：const toPath = compile('/user/:id')
    //       toPath({ id: 123 }) //=> "/user/123"
    // 先对Regexp.compile返回的函数做了缓存
    const filler =
      regexpCompileCache[path] ||
      (regexpCompileCache[path] = Regexp.compile(path))

    // Fix #2505 resolving asterisk routes { name: 'not-found', params: { pathMatch: '/not-found' }}
    // and fix #3106 so that you can work with location descriptor object having params.pathMatch equal to empty string
    // 修复#2505 解析*路由{name:'not found'，params:{pathMatch:'/not found'}
    // 修复#3106 以便可以使用params.pathMatch等于空字符串的位置描述符对象
    // 将matchRoute中添加的pathMatch赋值给params[0]
    if (typeof params.pathMatch === 'string') params[0] = params.pathMatch

    // 返回逆解析后的路径
    return filler(params, { pretty: true })
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      // Fix #3072 no warn if `pathMatch` is string
      warn(typeof params.pathMatch === 'string', `missing param for ${routeMsg}: ${e.message}`)
    }
    return ''
  } finally {
    // delete the 0 if it was added
    删除添加的params[0]
    delete params[0]
  }
}
