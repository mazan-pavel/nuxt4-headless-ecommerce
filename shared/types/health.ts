export interface HealthMemory {
  rss: number
  heapUsed: number
  heapTotal: number
  external: number
}

export interface HealthResponse {
  status: 'ok'
  timestamp: string
  uptime: number
  nodeVersion: string
  memory: HealthMemory
}
