/*
 * @Author: isboyjc
 * @Date: 2021-07-21 16:10:31
 * @LastEditors: isboyjc
 * @LastEditTime: 2021-07-23 05:17:34
  * @Description: 路由模式AbstractHistory子类
 */
import { History } from './base'
export class AbstractHistory extends History {
  constructor(router){
    super(router);
    // index、stack模拟历史记录栈
    this.stack = []
    this.index = -1
  }

  push(location, onComplete) {
    this.transitionTo(
      location,
      route => {
        this.stack = this.stack.slice(0, this.index + 1).concat(route)
        this.index++
        onComplete && onComplete(route)
      }
    )
  }

  replace(location, onComplete) {
    this.transitionTo(
      location,
      route => {
        this.stack = this.stack.slice(0, this.index).concat(route)
        onComplete && onComplete(route)
      }
    )
  }

  // TODO
  go() { }

  getCurrentLocation() {
    const current = this.stack[this.stack.length - 1]
    return current ? current.fullPath : '/'
  }

  ensureURL() {
    // noop
  }
}