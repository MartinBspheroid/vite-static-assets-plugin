import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteStaticAssetsPlugin from 'vite-static-assets-plugin';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), viteStaticAssetsPlugin(
    {
      directory: 'public',
      outputFile: 'src/static-assets.ts',
      ignore: ['**/.DS_Store'],
      maxDirectoryDepth: 5,
      allowEmptyDirectories: false,
      addLeadingSlash: true
    }
  )],
})
