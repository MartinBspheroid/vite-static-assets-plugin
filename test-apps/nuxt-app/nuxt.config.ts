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
        directory: 'public',
        typesOutputFile: 'app/static-assets.d.ts'
      })
    ]
  }
})
