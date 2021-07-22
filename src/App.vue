<template>
  <div id="app">
    <div id="nav">
      <router-link to="/">Home</router-link> |
      <router-link to="/about">About</router-link> ｜
      <router-link :to="{ path: '/parent' }">Parent</router-link> |
      <router-link :to="{ path: '/parent/child' }">Parent Child</router-link>
    </div>
    <router-view/>
  </div>
</template>

<script>
export default {
  mounted() {
    // this.$router.addRoute({
    //   path: "/parent",
    //   name: "Parent",
    //   component: ()=>import("@/views/Parent.vue"),
    //   children:[
    //     {
    //       path: "child",
    //       name:"Child",
    //       component:()=>import("@/views/Child.vue")
    //     }
    //   ]
    // })
  },
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}

#nav {
  padding: 30px;
}

#nav a {
  font-weight: bold;
  color: #2c3e50;
}

#nav a.router-link-exact-active {
  color: #42b983;
}
</style>
