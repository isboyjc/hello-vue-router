/*
 * @Author: isboyjc
 * @Date: 2021-07-20 02:03:11
 * @LastEditors: isboyjc
 * @LastEditTime: 2021-07-23 01:18:06
 * @Description: 插件安装方法install
 */

import View from "./components/view";
import Link from "./components/link";

export let _Vue;

export function install(Vue){
  // 防止插件被多次安装 - 当installed存在且为true 并且 _Vue已被赋值为Vue对象时，直接return，代表已经注册过
  if (install.installed && _Vue === Vue) return;
  install.installed = true;

  // 将注册插件时传递的Vue对象赋值给_Vue，便于VueRouter类中使用Vue的一些 API
  _Vue = Vue;

  // 全局注册混入，每个 Vue 实例都会被影响
  Vue.mixin({
    // Vue创建前钩子，此生命周期$options已挂载完成
    beforeCreate() {
      // 通过判断组件实例this.$options有无router属性来判断是否为根实例
      // 只有根实例初始化时我们挂载了VueRouter实例router（main.js中New Vue({router})时）
      if (this.$options.router) {
        this._routerRoot = this;
        // 在 Vue 根实例添加 _router 属性（ VueRouter 实例）
        this._router = this.$options.router;
        // 调用VueRouter实例初始化方法
        // _router即VueRouter实，此处this即Vue根实例
        this._router.init(this)
        // 把 ($route <=> _route) 处理为响应式的
        Vue.util.defineReactive(this, '_route', this._router.history.current);
      } else {
        // 为每个组件实例定义_routerRoot，回溯查找_routerRoot
        this._routerRoot = (this.$parent && this.$parent._routerRoot) || this
      }
    },
  });

  // 在 Vue 原型上添加 $router 属性( VueRouter )并代理到 this._routerRoot._router
  Object.defineProperty(Vue.prototype, "$router", {
    get() {
      return this._routerRoot._router;
    },
  });
  
  // 在 Vue 原型上添加 $route 属性( 当前路由对象 )并代理到 this._routerRoot._route
  Object.defineProperty(Vue.prototype, '$route', {
    get() {
      return this._routerRoot._route;
    }
  });

  // 全局注册组件router-view
  Vue.component('RouterView', View);

  // 全局注册组件router-link
  Vue.component('RouterLink', Link);  
}