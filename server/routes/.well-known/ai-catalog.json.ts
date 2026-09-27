import {
  DEFAULT_SITE_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_REPO_URL,
} from '#shared/config/site'
import { resolveSiteOrigin } from '../../utils/site'

interface AiCatalogEntry {
  identifier: string
  displayName: string
  type: string
  url: string
  description: string
  tags: string[]
  capabilities: string[]
  representativeQueries: [string, string, ...string[]]
  version: string
}

interface AiCatalogManifest {
  specVersion: '1.0'
  host: {
    displayName: string
    documentationUrl: string
  }
  entries: AiCatalogEntry[]
}

function catalogHost(origin: string): string {
  try {
    return new URL(origin).hostname
  }
  catch {
    return new URL(DEFAULT_SITE_URL).hostname
  }
}

export default defineEventHandler((event): AiCatalogManifest => {
  const origin = resolveSiteOrigin(event)
  const host = catalogHost(origin)

  const manifest: AiCatalogManifest = {
    specVersion: '1.0',
    host: {
      displayName: SITE_NAME,
      documentationUrl: `${origin}/llms.txt`,
    },
    entries: [
      {
        identifier: `urn:air:${host}:storefront:llms`,
        displayName: `${SITE_NAME} storefront guide`,
        type: 'text/plain',
        url: `${origin}/llms.txt`,
        description: SITE_DESCRIPTION,
        tags: ['ecommerce', 'storefront', 'llms.txt'],
        capabilities: ['SiteGuide', 'CatalogDiscovery'],
        representativeQueries: [
          'Atelier catalog',
          'buy home decoration',
          'Nuxt headless storefront',
        ],
        version: '1.0.0',
      },
      {
        identifier: `urn:air:${host}:storefront:sitemap`,
        displayName: `${SITE_NAME} URL sitemap`,
        type: 'application/xml',
        url: `${origin}/sitemap.xml`,
        description: 'XML sitemap of indexable storefront URLs for agent discovery.',
        tags: ['sitemap', 'discovery'],
        capabilities: ['UrlDiscovery'],
        representativeQueries: [
          'Atelier product pages',
          'list storefront URLs',
        ],
        version: '1.0.0',
      },
      {
        identifier: `urn:air:${host}:storefront:source`,
        displayName: `${SITE_NAME} source repository`,
        type: 'text/html',
        url: SITE_REPO_URL,
        description: 'Public GitHub repository for the Atelier Nuxt storefront.',
        tags: ['source', 'documentation'],
        capabilities: ['SourceCode'],
        representativeQueries: [
          'Atelier GitHub repo',
          'nuxt4 headless ecommerce source',
        ],
        version: '1.0.0',
      },
    ],
  }

  setHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600')
  return manifest
})
