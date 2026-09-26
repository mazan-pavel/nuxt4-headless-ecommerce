// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr:true,
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
    'h3-compression/nuxt',
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
  fonts: {
    defaults: {
      weights: [400, 600],
      styles: ['normal'],
      subsets: ['latin', 'cyrillic'],
    },
    families: [
      {
        name: 'Geist',
        provider: 'bunny',
        weights: [400, 600],
        // @nuxt/fonts v0.14 only preloads the single top-priority face;
        // subsetted faces need an explicit truthy preload to emit <link>.
        preload: true,
      },
    ],
  },
  image: {
    domains: ['cdn.dummyjson.com'],
  },
  nitro: {
    compressPublicAssets: true,
  },
  routeRules: {
    '/': {
      swr: 60,
      headers: { 'cache-control': 'public, max-age=0, must-revalidate' },
    },
    '/_nuxt/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
  },
  shadcn: {
    prefix: '',
    componentDir: './app/components/ui',
  },
})
