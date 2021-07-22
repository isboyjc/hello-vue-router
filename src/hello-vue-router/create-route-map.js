/*
 * @Author: isboyjc
 * @Date: 2021-07-21 16:10:55
 * @LastEditors: isboyjc
 * @LastEditTime: 2021-07-22 19:43:30
 * @Description: 生成路由映射
 */
// 生成路由映射
export function createRouteMap(routes, oldPathMap, parentRoute){
  const pathMap = oldPathMap || Object.create(null);
  // 递归处理路由记录，最终生成路由映射
  routes.forEach(route => {
    // 生成一个RouteRecord并更新pathMap
    addRouteRecord(pathMap, route, parentRoute)
  })
  return pathMap
}

// 添加路由记录
function addRouteRecord(pathMap, route, parent){
  const { path, name } = route

  // 生成格式化后的path(子路由会拼接上父路由的path)
  const normalizedPath = normalizePath(path, parent)

  // 生成一条路由记录
  const record = {
    path: normalizedPath, // 规范化后的路径
    regex: "", // 利用path-to-regexp包生成用来匹配path的增强正则对象，用来匹配动态路由 （/a/:b）
    components: route.component, // 保存路由组件，省略了命名视图解析
    name,
    parent, // 父路由记录
    redirect: route.redirect, // 重定向的路由配置对象
    beforeEnter: route.beforeEnter, // 路由独享的守卫
    meta: route.meta || {}, // 元信息
    props: route.props == null ? {} : route.props// 动态路由传参
  }

  // 处理有子路由情况，递归
  if (route.children) {
    // 遍历生成子路由记录
    route.children.forEach(child => {
      addRouteRecord(pathMap, child, record)
    })
  }

  // 若pathMap中不存在当前路径，则添加pathList和pathMap
  if (!pathMap[record.path]) {
    pathMap[record.path] = record
  }
}

// 规格化路径
function normalizePath(
  path,
  parent
) {
  // 下标0为 / ，则是最外层path
  if (path[0] === '/') return path
  // 无父级，则是最外层path
  if (!parent) return path
  // 清除path中双斜杆中的一个
  return `${parent.path}/${path}`.replace(/\/\//g, '/')
}