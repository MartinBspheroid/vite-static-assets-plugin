import staticAssets from 'vite-static-assets-plugin'

const baseURL = process.env.VITE_BASE || '/'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  app: { baseURL },
  vite: {
    base: baseURL,
    define: {
      'import.meta.env.BASE_URL': JSON.stringify(baseURL)
    },
    plugins: [
      staticAssets({
        // Nuxt 4 sets Vite's root to `app/`; the public/ dir lives at the
        // project root, so we go up one level. Resolution is now against
        // resolvedConfig.root (B3 fix), not process.cwd().
        directory: '../public',
        typesOutputFile: 'static-assets.d.ts'
      })
    ]
  }
})
