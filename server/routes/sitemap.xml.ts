import type { ProductsResponse } from '#shared/types/product'
import { DUMMYJSON_BASE_URL, handleDummyJsonError } from '../utils/dummyjson'
import { resolveSiteOrigin } from '../utils/site'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function fetchAllProductIds(): Promise<number[]> {
  const ids: number[] = []
  const limit = 100
  let skip = 0
  let total = Number.POSITIVE_INFINITY

  try {
    while (skip < total) {
      const page = await $fetch<ProductsResponse>(`${DUMMYJSON_BASE_URL}/products`, {
        query: { limit, skip, select: 'id' },
      })
      total = page.total
      for (const product of page.products) {
        ids.push(product.id)
      }
      if (page.products.length === 0) {
        break
      }
      skip += limit
    }
  }
  catch (error: unknown) {
    handleDummyJsonError(error)
  }

  return ids
}

export default defineCachedEventHandler(
  async (event) => {
    const origin = resolveSiteOrigin(event)
    const productIds = await fetchAllProductIds()
    const lastmod = new Date().toISOString()

    const staticPaths = ['/', '/catalog']
    const urls = [
      ...staticPaths.map(path => ({
        loc: `${origin}${path}`,
        priority: path === '/' ? '1.0' : '0.8',
      })),
      ...productIds.map(id => ({
        loc: `${origin}/product/${id}`,
        priority: '0.6',
      })),
    ]

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(entry => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('\n')}
</urlset>
`

    setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
    return body
  },
  {
    maxAge: 60 * 60,
    swr: true,
    name: 'sitemap-xml',
  },
)
