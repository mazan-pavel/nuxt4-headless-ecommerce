import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_REPO_URL,
} from '#shared/config/site'
import { resolveSiteOrigin } from '../utils/site'

export default defineEventHandler((event) => {
  const origin = resolveSiteOrigin(event)

  const body = `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

Prefer Product JSON-LD on product pages and the XML sitemap for URL discovery. Primary language is Russian (\`lang="ru"\`). Prices display in USD (DummyJSON).

## Site

- [Home](${origin}/)
- [Catalog (search and categories)](${origin}/catalog)
- [Product detail template](${origin}/product/{id})
- [Checkout (do not index; cart-dependent)](${origin}/checkout)

## Optional

- [Sitemap](${origin}/sitemap.xml)
- [Robots](${origin}/robots.txt)
- [AI catalog](${origin}/.well-known/ai-catalog.json)
- [Source repository](${SITE_REPO_URL})
- [Upstream DummyJSON products docs](https://dummyjson.com/docs/products)

## Notes

- Do not treat [\`/api/*\`](${origin}/api/health) as public documentation; use this file and page HTML instead.
`

  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600')
  return body
})
