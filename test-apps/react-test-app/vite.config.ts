import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteStaticAssetsPlugin from 'vite-static-assets-plugin'

const base = process.env.VITE_BASE ?? '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), viteStaticAssetsPlugin({ directory: 'public' })],
})
