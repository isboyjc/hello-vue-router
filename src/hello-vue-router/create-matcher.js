/*
 * @Author: isboyjc
 * @Date: 2021-07-21 16:10:44
 * @LastEditors: isboyjc
 * @LastEditTime: 2021-07-22 19:47:11
 * @Description: 路由匹配器Matcher对象生成方法
 */
import { createRouteMap } from "./create-route-map";
import { createRoute } from "./utils/route"

// 路由匹配器Matcher对象生成方法
export function createMatcher(routes){
  // 生成路由映射对象 pathMap
  const pathMap = createRouteMap(routes)

  // 动态添加路由（添加一条新路由规则）
  function addRoute(parentOrRoute, route){
    const parent = (typeof parentOrRoute !== 'object') ? pathMap[parentOrRoute] : undefined
    createRouteMap([route || parentOrRoute], pathMap, parent)
  }

  // 动态添加路由（参数必须是一个符合 routes 选项要求的数组）
  function addRoutes(routes){
    createRouteMap(routes, pathMap)
  }

  // 获取所有活跃的路由记录列表
  function getRoutes(){
    return pathMap
  }

  // 路由匹配
  function match(location){
    location = typeof location === 'string' ? { path: location } : location
    return createRoute(pathMap[location.path], location)
  }

  return {
    match,
    addRoute,
    getRoutes,
    addRoutes
  }
}