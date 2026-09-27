// https://nuxt.com/docs/api/configuration/nuxt-config
import {
  DEFAULT_SITE_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
} from './shared/config/site'

export default defineNuxtConfig({
  ssr: true,
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
  runtimeConfig: {
    public: {
      siteUrl: DEFAULT_SITE_URL,
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      titleTemplate: `%s · ${SITE_NAME}`,
      meta: [
        { name: 'description', content: SITE_DESCRIPTION },
        { property: 'og:site_name', content: SITE_NAME },
        { property: 'og:locale', content: 'ru_RU' },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      link: [
        { rel: 'alternate', type: 'text/plain', href: '/llms.txt', title: 'llms.txt' },
        { rel: 'ai-catalog', href: '/.well-known/ai-catalog.json' },
      ],
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
    '/catalog': {
      swr: 60,
      headers: { 'cache-control': 'public, max-age=0, must-revalidate' },
    },
    '/product/**': {
      swr: 300,
      headers: { 'cache-control': 'public, max-age=0, must-revalidate' },
    },
    '/checkout': {
      headers: { 'x-robots-tag': 'noindex, nofollow' },
    },
    '/sitemap.xml': {
      headers: { 'cache-control': 'public, max-age=3600' },
    },
    '/robots.txt': {
      headers: { 'cache-control': 'public, max-age=3600' },
    },
    '/llms.txt': {
      headers: { 'cache-control': 'public, max-age=3600' },
    },
    '/.well-known/ai-catalog.json': {
      headers: { 'cache-control': 'public, max-age=3600' },
    },
    '/_nuxt/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
  },
  shadcn: {
    prefix: '',
    componentDir: './app/components/ui',
  },
})