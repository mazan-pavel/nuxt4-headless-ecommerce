/**
 * Feeds string chunks and emits complete lines (NDJSON).
 * Keeps a buffer for a trailing incomplete line until the next chunk or flush.
 */
export function createNdjsonLineParser(onLine: (line: string) => void): {
  push: (chunk: string) => void
  flush: () => void
} {
  let buffer = ''

  return {
    push(chunk: string) {
      buffer += chunk
      while (true) {
        const newlineAt = buffer.indexOf('\n')
        if (newlineAt === -1) {
          return
        }
        const line = buffer.slice(0, newlineAt).trim()
        buffer = buffer.slice(newlineAt + 1)
        if (line.length > 0) {
          onLine(line)
        }
      }
    },
    flush() {
      const line = buffer.trim()
      buffer = ''
      if (line.length > 0) {
        onLine(line)
      }
    },
  }
}
