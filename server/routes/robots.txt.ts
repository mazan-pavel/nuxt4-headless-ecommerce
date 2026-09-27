import {
  SITE_NAME,
} from '#shared/config/site'
import { resolveSiteOrigin } from '../utils/site'

export default defineEventHandler((event) => {
  const origin = resolveSiteOrigin(event)
  const body = `# ${SITE_NAME} — crawlers
User-agent: *
Allow: /
Disallow: /checkout
Disallow: /api/

# Generative / AI crawlers
User-agent: GPTBot
Allow: /
Disallow: /checkout
Disallow: /api/

User-agent: ChatGPT-User
Allow: /
Disallow: /checkout
Disallow: /api/

User-agent: Google-Extended
Allow: /
Disallow: /checkout
Disallow: /api/

User-agent: ClaudeBot
Allow: /
Disallow: /checkout
Disallow: /api/

User-agent: anthropic-ai
Allow: /
Disallow: /checkout
Disallow: /api/

User-agent: PerplexityBot
Allow: /
Disallow: /checkout
Disallow: /api/

User-agent: Applebot-Extended
Allow: /
Disallow: /checkout
Disallow: /api/

Sitemap: ${origin}/sitemap.xml
Agentmap: ${origin}/.well-known/ai-catalog.json
`

  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600')
  return body
})
