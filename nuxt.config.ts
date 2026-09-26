// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  future: {
    compatibilityVersion: 4,
  },
  // Devtools only in development — keeps production JS leaner
  devtools: { enabled: import.meta.dev },
  modules: [
    '@nuxtjs/tailwindcss',
    'shadcn-nuxt',
    '@pinia/nuxt',
    '@nuxt/image',
    '@vueuse/nuxt',
    '@nuxt/eslint',
    '@nuxt/fonts',
  ],
  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
    },
  },
  tailwindcss: {
    cssPath: '~/assets/css/main.css',
    configPath: 'tailwind.config.ts',
  },
  // System UI stack in CSS; keep module for when/app adds web fonts (font-display: swap)
  fonts: {
    defaults: {
      weights: [400, 600],
      styles: ['normal'],
      subsets: ['latin', 'cyrillic'],
    },
  },
  image: {
    domains: ['cdn.dummyjson.com'],
  },
  nitro: {
    compressPublicAssets: true,
  },
  routeRules: {
    '/': { headers: { 'cache-control': 'public, max-age=0, must-revalidate' } },
    '/_nuxt/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
  },
  shadcn: {
    prefix: '',
    componentDir: './app/components/ui',
  },
})
