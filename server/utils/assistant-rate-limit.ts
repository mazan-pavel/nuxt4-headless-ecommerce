import type { H3Event } from 'h3'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export type AssistantRateLimitResult =
  | { ok: true }
  | { ok: false, statusCode: 429 | 503, message: string }

interface MemoryBucket {
  count: number
  resetAt: number
}

const memoryBuckets = new Map<string, MemoryBucket>()

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value !== undefined && value !== '' ? value : undefined
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = readEnv(name)
  if (raw === undefined) {
    return fallback
  }
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback
  }
  return parsed
}

function upstashConfigured(): boolean {
  return readEnv('UPSTASH_REDIS_REST_URL') !== undefined
    && readEnv('UPSTASH_REDIS_REST_TOKEN') !== undefined
}

function takeMemory(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now()
  const current = memoryBuckets.get(key)
  if (current === undefined || now >= current.resetAt) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (current.count >= limit) {
    return false
  }
  current.count += 1
  return true
}

function createUpstashLimiters(ipLimit: number, windowMin: number, dailyLimit: number) {
  const redis = Redis.fromEnv()
  return {
    ip: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(ipLimit, `${windowMin} m`),
      prefix: 'atelier:assistant:ip',
      analytics: false,
    }),
    daily: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(dailyLimit, '1 d'),
      prefix: 'atelier:assistant:daily',
      analytics: false,
    }),
  }
}

let cachedUpstash: ReturnType<typeof createUpstashLimiters> | undefined

function getUpstashLimiters(ipLimit: number, windowMin: number, dailyLimit: number) {
  cachedUpstash ??= createUpstashLimiters(ipLimit, windowMin, dailyLimit)
  return cachedUpstash
}

/**
 * IP + global daily limits for POST /api/assistant.
 * Upstash when configured; otherwise in-memory only in `import.meta.dev`.
 * Production without Upstash fails closed with 503.
 */
export async function enforceAssistantRateLimit(
  event: H3Event,
): Promise<AssistantRateLimitResult> {
  const ipLimit = readPositiveInt('ASSISTANT_IP_LIMIT', 10)
  const windowMin = readPositiveInt('ASSISTANT_IP_WINDOW_MIN', 10)
  const dailyLimit = readPositiveInt('ASSISTANT_DAILY_LIMIT', 20)
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'

  if (upstashConfigured()) {
    try {
      const limiters = getUpstashLimiters(ipLimit, windowMin, dailyLimit)
      const ipResult = await limiters.ip.limit(ip)
      if (!ipResult.success) {
        return {
          ok: false,
          statusCode: 429,
          message: 'Слишком много запросов с вашего адреса. Подождите немного.',
        }
      }
      const dailyResult = await limiters.daily.limit('global')
      if (!dailyResult.success) {
        return {
          ok: false,
          statusCode: 429,
          message: 'Дневной лимит консультанта исчерпан. Попробуйте завтра.',
        }
      }
      return { ok: true }
    }
    catch {
      console.error('assistant rate limit backend failed')
      return {
        ok: false,
        statusCode: 503,
        message: 'Лимитер консультанта временно недоступен.',
      }
    }
  }

  if (!import.meta.dev) {
    return {
      ok: false,
      statusCode: 503,
      message: 'Консультант не настроен: в production нужен Upstash Redis.',
    }
  }

  const windowMs = windowMin * 60 * 1000
  const dayMs = 24 * 60 * 60 * 1000
  if (!takeMemory(`ip:${ip}`, ipLimit, windowMs)) {
    return {
      ok: false,
      statusCode: 429,
      message: 'Слишком много запросов с вашего адреса. Подождите немного.',
    }
  }
  if (!takeMemory('daily:global', dailyLimit, dayMs)) {
    return {
      ok: false,
      statusCode: 429,
      message: 'Дневной лимит консультанта исчерпан. Попробуйте завтра.',
    }
  }
  return { ok: true }
}
