<script setup lang="ts">

import { staticAssets, type FilesInFolder} from "./static-assets"

type  Icons = FilesInFolder<'icons/sun/'>;

type Suns = {
  icon: Icons,
  name: string

}

const suns: Suns[] = [
  {
    icon: "icons/sun/line-md--sunny.svg",
    name: "Sunny"
  },
  {
    icon: "icons/sun/line-md--sun-rising-loop.svg",
    name: "Sun Rising"
  },
  {
    icon: "icons/sun/line-md--sun-rising-twotone-loop.svg",
    name: "Sun Rising Twotone"
  },
  {
    icon: "icons/sun/line-md--sun-rising-filled-loop.svg",
    name: "Sun Rising Filled"
  }

]

</script>

<template>
  <div>
    <img :src="staticAssets('logo.png')" class="logo" alt="Vite Static Assets logo" />
    <a href="https://vite.dev" target="_blank">
      <img src="/vite.svg" class="logo" alt="Vite logo" />
    </a>
    <a href="https://vuejs.org/" target="_blank">
      <img src="./assets/vue.svg" class="logo vue" alt="Vue logo" />
    </a>
  </div>
  <h1>Vite + <span style="color: lightblue;">vite-static-assets-plugin</span> + Vue</h1>
  
  <div class="suns-list">
    <div v-for="(sun, index) in suns" :key="index" class="sun-item">
      <img :src="sun.icon" :alt="sun.name" class="sun-icon" />
      <span>{{ sun.name }}</span>
    </div>
  </div>
   
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
