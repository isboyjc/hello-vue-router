/*
 * @Author: isboyjc
 * @Date: 2021-07-20 01:09:49
 * @LastEditors: isboyjc
 * @LastEditTime: 2021-07-23 07:31:06
 * @Description: VueRouter入口文件 VueRouter类
 */
import { install } from "./install";
import { createMatcher } from "./create-matcher";
import { HashHistory } from "./history/hash";
import { HTML5History } from "./history/html5";
import { AbstractHistory } from "./history/abstract";
const inBrowser = typeof window !== "undefined";

export default class VueRouter{
  constructor(options){
    // 路由配置
    this.options = options
    // 创建路由matcher对象，传入routes路由配置列表及VueRouter实例，主要负责url匹配
    this.matcher = createMatcher(options.routes);

    let mode = options.mode || "hash";

    // 支持所有 JavaScript 运行环境，非浏览器环境强制使用abstract模式，主要用于SSR
    if (!inBrowser) {
      mode = "abstract";
    }

    this.mode = mode;

    // 根据不同mode，实例化不同history实例
    switch (mode) {
      case "history":
        console.log("history");
        this.history = new HTML5History(this);
        break;
      case "hash":
        console.log("hash");
        this.history = new HashHistory(this);
        break;
      case "abstract":
        console.log("abstract");
        this.history = new AbstractHistory(this);
        break;
      default:
        if (process.env.NODE_ENV !== "production") {
          throw new Error(`[vue-router] invalid mode: ${mode}`);
        }
    }
  }

  init(app) {
    // 绑定destroyed hook，避免内存泄露
    app.$once('hook:destroyed', () => {
      this.app = null

      if (!this.app) this.history.teardown()
    })

    // 存在即不需要重复监听路由
    if (this.app) return;

    this.app = app;

    // 跳转当前路由path匹配渲染 用于页面初始化
    this.history.transitionTo(
      // 获取当前页面 path
      this.history.getCurrentLocation(),
      () => {
        // 启动监听
        this.history.setupListeners();
      }
    )

    // 传入赋值回调，为_route赋值，进而触发router-view的重新渲染，当前路由对象改变时调用
    this.history.listen((route) => {
      app._route = route
    })
  }

  // 匹配路由
  match(location) {
    return this.matcher.match(location)
  }
  
  // 获取所有活跃的路由记录列表
  getRoutes() {
    return this.matcher.getRoutes()
  }
  
  // 动态添加路由（添加一条新路由规则）
  addRoute(parentOrRoute, route) {
    this.matcher.addRoute(parentOrRoute, route)
  }
  
  // 动态添加路由（参数必须是一个符合 routes 选项要求的数组）
  addRoutes(routes) {
    this.matcher.addRoutes(routes)
  }

  // 导航到新url，向 history栈添加一条新访问记录
  push(location) {
    this.history.push(location)
  }

  // 在 history 记录中向前或者后退多少步
  go(n) {
    this.history.go(n);
  }

  // 导航到新url，替换 history 栈中当前记录
  replace(location, onComplete) {
    this.history.replace(location, onComplete)
  }

  // 导航回退一步
  back() {
    this.history.go(-1)
  }
}
VueRouter.install = install;