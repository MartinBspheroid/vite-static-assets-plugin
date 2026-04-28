import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import viteStaticAssetsPlugin from 'vite-static-assets-plugin'

const base = process.env.VITE_BASE ?? '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [vue(), viteStaticAssetsPlugin({ directory: 'public' })],
})
