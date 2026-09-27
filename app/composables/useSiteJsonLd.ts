import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_REPO_URL,
} from '#shared/config/site'

/**
 * Global Organization + WebSite JSON-LD for AI crawlers and rich results.
 */
export function useSiteJsonLd() {
  const { absoluteUrl } = useSiteUrl()

  useJsonLd(() => {
    const origin = absoluteUrl('/')
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        '@id': `${origin}#organization`,
        name: SITE_NAME,
        url: origin,
        description: SITE_DESCRIPTION,
        sameAs: [SITE_REPO_URL],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        '@id': `${origin}#website`,
        name: SITE_NAME,
        url: origin,
        description: SITE_DESCRIPTION,
        inLanguage: 'ru-RU',
        publisher: { '@id': `${origin}#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${absoluteUrl('/catalog')}?search={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ]
  })
}
