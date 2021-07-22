/*
 * @Author: isboyjc
 * @Date: 2021-07-21 00:36:24
 * @LastEditors: isboyjc
 * @LastEditTime: 2021-07-23 05:42:03
 * @Description: router-view组件
 */
export default {
  name: "RouterView",
  functional: true, // 函数式组件
  render(h,  { parent, data}) {
    // parent：对父组件的引用
    // data：传递给组件的整个数据对象，作为 createElement 的第二个参数传入组件
    
    // 标识当前组件为router-view
    data.routerView = true

    let depth = 0;
    // 逐级向上查找组件，当parent指向Vue根实例结束循环
    while(parent && parent._routerRoot !== parent){
      const vnodeData = parent.$vnode ? parent.$vnode.data : {};
      // routerView属性存在即路由组件深度+1，depth+1
      if(vnodeData.routerView){
        depth++
      }

      parent = parent.$parent
    }


    let route = parent.$route

    if (!route.matched) return h();

    // route.matched还是当前path全部关联的路由配置数组
    // 渲染的哪个组件，走上面逻辑时就会找到depth个RouterView组件
    // 由于逐级向上时是从父级组件开始找，所以depth数量并没有包含当前路由组件
    // 假如depth=2，则route.matched数组前两项都是父级，第三项则是当前组件，所以depth=索引
    let matched = route.matched[depth]

    if (!matched) return h();

    return h(matched.components, data)
  }
}