import { DEFAULT_SITE_URL } from '#shared/config/site'

/**
 * Absolute site URL helpers for canonical, OG, and JSON-LD.
 * Reads `runtimeConfig.public.siteUrl` (NUXT_PUBLIC_SITE_URL).
 */
export function useSiteUrl() {
  const config = useRuntimeConfig()

  const siteUrl = computed(() => {
    const raw = String(config.public.siteUrl || DEFAULT_SITE_URL).trim()
    return raw.replace(/\/+$/, '') || DEFAULT_SITE_URL
  })

  function absoluteUrl(path = '/'): string {
    if (/^https?:\/\//i.test(path)) {
      return path
    }
    const normalized = path.startsWith('/') ? path : `/${path}`
    return `${siteUrl.value}${normalized}`
  }

  return { siteUrl, absoluteUrl }
}
