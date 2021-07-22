/*
 * @Author: isboyjc
 * @Date: 2021-07-21 16:10:02
 * @LastEditors: isboyjc
 * @LastEditTime: 2021-07-23 01:57:38
 * @Description: 路由父类History
 */
import { START } from "../utils/route";

export class History {
  constructor(router) {
    this.router = router;
    // 当前路由route对象
    this.current = START;
    // 路由监听器数组，存放路由监听销毁方法
    this.listeners = [];
  }
  
  // 启动路由监听
  setupListeners() { }

  // 保存赋值回调
  listen(cb){
    this.cb = cb
  }

  // 路由跳转
  transitionTo(location, onComplete) {
    // 路由匹配，解析location匹配到其路由对应的数据对象
    let route = this.router.match(location);

    // 更新current
    this.current = route;

    // 调用赋值回调，传出新路由对象，用于更新 _route
    this.cb && this.cb(route)

    // 为_routerRoot._route赋值，进而触发router-view的重新渲染
    // this.router.app._route = route
    
    // 跳转成功抛出回调
    onComplete && onComplete(route)

    // 更新URL
    this.ensureURL()
  }

  // 卸载
  teardown() {
    this.listeners.forEach((cleanupListener) => {
      cleanupListener();
    });

    this.listeners = [];
    this.current = "";
  }
}