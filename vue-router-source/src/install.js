/*
 * @Author: isboyjc
 * @Date: 2021-07-15 22:35:37
 * @LastEditors: isboyjc
 * @LastEditTime: 2021-07-16 01:52:25
 * @Description: 插件安装方法install
 */
import View from './components/view'
import Link from './components/link'

// 用来避免将Vue做为依赖打包进来，后续保留Vue引用
export let _Vue

export function install(Vue) {
  // 防止插件被多次安装 - 当installed存在且为true 并且 _Vue已被赋值为Vue对象时，直接return，代表已经注册过
  if (install.installed && _Vue === Vue) return
  install.installed = true

  // 将注册插件时传递的Vue对象赋值给_Vue，便于VueRouter类中使用Vue的一些 API
  _Vue = Vue

  // isDef方法校验传入值是否等于undefined
  // 等于返回false，不等于返回true
  const isDef = v => v !== undefined

  // 为router-view组件关联或解绑路由组件
  const registerInstance = (vm, callVal) => {
    let i = vm.$options._parentVnode
    // 调用vm.$options._parentVnode.data.registerRouteInstance方法
    // 而这个方法只在router-view组件中存在
    // 所以，如果vm的父节点为router-view，则为router-view关联当前vm，即将当前vm做为router-view的路由组件
    if (isDef(i) && isDef(i = i.data) && isDef(i = i.registerRouteInstance)) {
      i(vm, callVal)
    }
  }

  // 全局注册混入，每个 Vue 实例都会被影响
  Vue.mixin({
    // Vue创建前钩子
    beforeCreate() {
      // 通过判断组件实例this.$options有无router属性来判断是否为根实例
      // 只有根实例初始化时我们挂载了VueRouter实例router（main.js中New Vue({router})时）
      if (isDef(this.$options.router)) {
        // 根实例上保存_routerRoot，标识router挂载的Vue根实例
        this._routerRoot = this
        // 挂载_router，即Vue实例上的$router
        // 在 Vue 根实例添加 _router 属性（ VueRouter 实例）
        this._router = this.$options.router
        // beforeCreate hook被触发时调用，执行路由实例的 init 方法并传入 Vue 根实例
        this._router.init(this)
        // 把 ($route <=> _route) 处理为响应式的，保证_route发生变化时，组件(router-view)会重新渲染
        Vue.util.defineReactive(this, '_route', this._router.history.current)
      } else {
        // 为每个组件实例定义_routerRoot，回溯查找_routerRoot
        this._routerRoot = (this.$parent && this.$parent._routerRoot) || this
      }
      // 为router-view组件关联路由组件
      registerInstance(this, this)
    },
    destroyed() {
      // destroyed hook触发时，取消router-view和路由组件的关联
      registerInstance(this)
    }
  })

  // 在 Vue 原型上添加 $router 属性( VueRouter )并代理到 this.$root._router，方便在vue实例中通过this.$router快捷访问
  Object.defineProperty(Vue.prototype, '$router', {
    get() { return this._routerRoot._router }
  })

  // 在 Vue 原型上添加 $route 属性( 当前路由对象 )并代理到 this.$root._route，方便在vue实例中通过this.$route快捷访问
  Object.defineProperty(Vue.prototype, '$route', {
    get() { return this._routerRoot._route }
  })

  // 全局注册组件router-view
  Vue.component('RouterView', View)
  // 全局注册组件router-link
  Vue.component('RouterLink', Link)

  const strats = Vue.config.optionMergeStrategies
  // use the same hook merging strategy for route hooks
  strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate = strats.created
}
