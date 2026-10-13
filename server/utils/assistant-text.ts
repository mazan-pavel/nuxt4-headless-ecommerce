import type { AssistantShownProduct } from '#shared/types/assistant'

const SHOWN_MARKERS = ['[показано пользователю', 'показано пользователю'] as const
const SHOWN_HOLD = Math.max(...SHOWN_MARKERS.map(marker => marker.length)) - 1

export function formatShownNote(items: readonly AssistantShownProduct[]): string {
  const list = items
    .map((item, index) => {
      const title = item.title.replace(/[\r\n\]]+/g, ' ').replace(/\s+/g, ' ').trim()
      return `${index + 1}) ${title} (id ${item.id})`
    })
    .join('; ')
  return `[Показано пользователю: ${list}]`
}

export interface ShownNoteFilter {
  push: (delta: string) => string
  flush: () => string
}

function markerIndex(text: string): number {
  const lower = text.toLowerCase()
  let found = -1
  for (const marker of SHOWN_MARKERS) {
    const at = lower.indexOf(marker)
    if (at !== -1 && (found === -1 || at < found)) {
      found = at
    }
  }
  return found
}

/**
 * Drops lines that repeat the server note `[Показано пользователю: …]`,
 * including when the marker is split across streamed chunks.
 */
export function createShownNoteFilter(): ShownNoteFilter {
  let pending = ''
  let dropping = false

  function drain(): string {
    let safe = ''
    while (pending.length > 0) {
      if (dropping) {
        const newlineAt = pending.indexOf('\n')
        if (newlineAt === -1) {
          pending = ''
          return safe
        }
        pending = pending.slice(newlineAt + 1)
        dropping = false
        continue
      }

      const markerAt = markerIndex(pending)
      if (markerAt !== -1) {
        safe += pending.slice(0, markerAt)
        pending = pending.slice(markerAt)
        dropping = true
        continue
      }

      if (pending.length <= SHOWN_HOLD) {
        return safe
      }
      safe += pending.slice(0, pending.length - SHOWN_HOLD)
      pending = pending.slice(pending.length - SHOWN_HOLD)
      return safe
    }
    return safe
  }

  return {
    push(delta: string) {
      pending += delta
      return drain()
    },
    flush() {
      if (dropping) {
        pending = ''
        dropping = false
        return ''
      }
      const markerAt = markerIndex(pending)
      const safe = markerAt === -1 ? pending : pending.slice(0, markerAt)
      pending = ''
      return safe
    },
  }
}
