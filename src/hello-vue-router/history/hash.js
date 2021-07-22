/*
 * @Author: isboyjc
 * @Date: 2021-07-21 16:10:20
 * @LastEditors: isboyjc
 * @LastEditTime: 2021-07-22 19:49:27
 * @Description: 路由模式HashHistory子类
 */
import { History } from './base'

export class HashHistory extends History {
  constructor(router) {
    // 继承父类
    super(router);
  }
  
  // 启动路由监听
  setupListeners() {
    // 路由监听回调
    const handleRoutingEvent = () => {
      let location = getHash();
      this.transitionTo(location, () => {
        console.log(`Hash路由监听跳转成功！`);
      });
    };

    window.addEventListener("hashchange", handleRoutingEvent);
    this.listeners.push(() => {
      window.removeEventListener("hashchange", handleRoutingEvent);
    });
  }

  // 更新URL
  ensureURL() {
    window.location.hash = this.current.fullPath;
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
      window.location.replace(getUrl(route.fullPath))
      onComplete && onComplete(route)
    })
  }

  // 获取当前路由
  getCurrentLocation() {
    return getHash()
  }
}

// 获取location hash路由
export function getHash() {
  let href = window.location.href;
  const index = href.indexOf("#");
  if (index < 0) return "/";

  href = href.slice(index + 1);

  return href;
}

// 获取URL
function getUrl(path) {
  const href = window.location.href
  const i = href.indexOf('#')
  const base = i >= 0 ? href.slice(0, i) : href
  return `${base}#${path}`
}