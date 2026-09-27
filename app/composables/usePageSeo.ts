import { SITE_DESCRIPTION, SITE_NAME } from '#shared/config/site'

export interface PageSeoInput {
  title: MaybeRefOrGetter<string>
  description?: MaybeRefOrGetter<string | undefined>
  /** Path for canonical; defaults to current route path (no query). */
  path?: MaybeRefOrGetter<string | undefined>
  ogImage?: MaybeRefOrGetter<string | undefined>
  ogType?: MaybeRefOrGetter<'website' | 'product' | undefined>
  robots?: MaybeRefOrGetter<string | undefined>
}

/**
 * Canonical + Open Graph + Twitter meta aligned with Lighthouse SEO.
 */
export function usePageSeo(input: PageSeoInput) {
  const route = useRoute()
  const { absoluteUrl } = useSiteUrl()

  const title = computed(() => toValue(input.title))
  const description = computed(
    () => toValue(input.description) || SITE_DESCRIPTION,
  )
  const path = computed(() => {
    const override = toValue(input.path)
    if (override !== undefined && override !== '') {
      return override
    }
    return route.path
  })
  const canonical = computed(() => absoluteUrl(path.value))
  const ogImage = computed(() => {
    const image = toValue(input.ogImage)
    if (image === undefined || image === '') {
      return undefined
    }
    return absoluteUrl(image)
  })
  const ogType = computed(() => toValue(input.ogType) ?? 'website')
  // Explicit default avoids sticky noindex after client nav from /checkout.
  const robots = computed(() => toValue(input.robots) ?? 'index, follow')

  useSeoMeta({
    title: () => title.value,
    description: () => description.value,
    ogTitle: () => title.value,
    ogDescription: () => description.value,
    ogUrl: () => canonical.value,
    ogType: () => ogType.value,
    ogSiteName: SITE_NAME,
    ogImage: () => ogImage.value,
    twitterCard: 'summary_large_image',
    twitterTitle: () => title.value,
    twitterDescription: () => description.value,
    twitterImage: () => ogImage.value,
    robots: () => robots.value,
  })

  useHead(() => ({
    link: [
      {
        rel: 'canonical',
        href: canonical.value,
      },
    ],
  }))
}
