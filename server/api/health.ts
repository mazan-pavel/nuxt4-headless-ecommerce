import type { HealthResponse } from '#shared/types/health'

export default defineEventHandler((): HealthResponse => {
  const memory = process.memoryUsage()

  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    nodeVersion: process.version,
    memory: {
      rss: memory.rss,
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      external: memory.external,
    },
  }
})
