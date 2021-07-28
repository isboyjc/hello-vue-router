/*
 * @Author: isboyjc
 * @Date: 2021-07-21 16:10:07
 * @LastEditors: isboyjc
 * @LastEditTime: 2021-07-29 01:55:33
 * @Description: 路由模式HTML5History子类
 */
import { History } from './base'

export class HTML5History extends History {
  constructor(router) {
    // 继承父类
    super(router);
  }

  // 启动路由监听
  setupListeners() {
    // 路由监听回调
    const handleRoutingEvent = () => {

      this.transitionTo(getLocation(), () => {
        console.log(`HTML5路由监听跳转成功！`);
      });
    };

    window.addEventListener("popstate", handleRoutingEvent);
    this.listeners.push(() => {
      window.removeEventListener("popstate", handleRoutingEvent);
    });
  }

  // 更新URL
  ensureURL() {
    if (getLocation() !== this.current.fullPath) {
      window.history.pushState({ key: Date.now().toFixed(3) }, "", this.current.fullPath);
    }
  }

  // 路由跳转方法
  push(location, onComplete) {
    this.transitionTo(location, onComplete)
  }

  // 路由前进后退
  go(n){
    window.history.go(n)
  }

  // 跳转到指定URL，替换history栈中最后一个记录
  replace(location, onComplete) {
    this.transitionTo(location, (route) => {
      window.history.replaceState(window.history.state, '', route.fullPath)
      onComplete && onComplete(route)
    })
  }

  // 获取当前路由
  getCurrentLocation() {
    return getLocation()
  }
}

// 获取location HTML5 路由
function getLocation() {
  let path = window.location.pathname;
  return path;
}