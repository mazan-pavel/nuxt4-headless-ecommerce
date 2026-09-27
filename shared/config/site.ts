/** Public site identity — used by SEO, JSON-LD, robots, and llms.txt. */
export const SITE_NAME = 'Atelier' as const

export const SITE_TAGLINE = 'Магазин без лишнего шума' as const

export const SITE_DESCRIPTION
  = 'Atelier — тихая витрина на Nuxt 4: категории, поиск, корзина и оформление заказа. Демо-ассортимент через DummyJSON.' as const

/** Fallback when `NUXT_PUBLIC_SITE_URL` is unset (matches live Vercel deploy). */
export const DEFAULT_SITE_URL
  = 'https://nuxt4-headless-ecommerce.vercel.app' as const

export const SITE_LOCALE = 'ru' as const

export const SITE_REPO_URL
  = 'https://github.com/mazan-pavel/nuxt4-headless-ecommerce' as const
