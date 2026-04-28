<script setup lang="ts">
import { staticAssets } from 'virtual:static-assets'
import './check'

const logoUrl = staticAssets('logo.png')
const iconUrl = staticAssets('icons/sun/sun.svg')
</script>

<template>
  <div>
    <img id="harness-logo" :src="logoUrl" alt="logo" />
    <div id="harness-asset-url">{{ logoUrl }}</div>
    <div id="harness-icon-url">{{ iconUrl }}</div>
  </div>
</template>
