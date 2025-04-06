import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import viteStaticAssetsPlugin from 'vite-static-assets-plugin';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), viteStaticAssetsPlugin(
    {
      directory: 'public',
      outputFile: 'src/static-assets.ts',
      
    }
  )],
})
