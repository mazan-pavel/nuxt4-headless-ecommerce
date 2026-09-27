import { DEFAULT_SITE_URL } from '#shared/config/site'
import type { H3Event } from 'h3'

/** Resolve the public origin for absolute robots/sitemap URLs. */
export function resolveSiteOrigin(event: H3Event): string {
  const config = useRuntimeConfig(event)
  const fromEnv = String(config.public.siteUrl || '').trim().replace(/\/+$/, '')
  if (fromEnv !== '') {
    return fromEnv
  }
  try {
    const url = getRequestURL(event)
    return `${url.protocol}//${url.host}`
  }
  catch {
    return DEFAULT_SITE_URL
  }
}
