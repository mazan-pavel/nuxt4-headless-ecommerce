import {
  ASSISTANT_MAX_CONTENT_LENGTH,
  ASSISTANT_MAX_MESSAGES,
  ASSISTANT_MAX_SHOWN,
} from '#shared/config/assistant'
import type {
  AssistantCartItem,
  AssistantChatMessage,
  AssistantClientMessage,
  AssistantEvent,
  AssistantProductCard,
  AssistantRequest,
} from '#shared/types/assistant'
import { createNdjsonLineParser } from '~/utils/ndjson'

const HTTP_ERROR_MESSAGES: Record<number, string> = {
  400: 'Некорректный запрос к консультанту.',
  429: 'Слишком много запросов. Подождите немного и попробуйте снова.',
  503: 'Консультант временно недоступен. Проверьте настройки сервера.',
}

function messageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isProductCard(value: unknown): value is AssistantProductCard {
  if (!isRecord(value)) {
    return false
  }
  return typeof value.id === 'number'
    && typeof value.title === 'string'
    && typeof value.price === 'number'
    && typeof value.discountPercentage === 'number'
    && typeof value.rating === 'number'
    && typeof value.thumbnail === 'string'
    && typeof value.stock === 'number'
}

function isCartItem(value: unknown): value is AssistantCartItem {
  if (!isRecord(value)) {
    return false
  }
  return typeof value.id === 'number'
    && typeof value.title === 'string'
    && typeof value.price === 'number'
    && typeof value.discountPercentage === 'number'
    && typeof value.thumbnail === 'string'
    && typeof value.stock === 'number'
}

export function parseAssistantEvent(value: unknown): AssistantEvent | undefined {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return undefined
  }

  switch (value.type) {
    case 'text':
      if (typeof value.delta !== 'string') {
        return undefined
      }
      return { type: 'text', delta: value.delta }
    case 'products':
      if (!Array.isArray(value.items) || !value.items.every(isProductCard)) {
        return undefined
      }
      return { type: 'products', items: value.items }
    case 'cart_add':
      if (!isCartItem(value.item) || typeof value.quantity !== 'number') {
        return undefined
      }
      return {
        type: 'cart_add',
        item: value.item,
        quantity: value.quantity,
      }
    case 'error':
      if (typeof value.message !== 'string') {
        return undefined
      }
      return { type: 'error', message: value.message }
    default:
      return undefined
  }
}

function httpErrorMessage(status: number): string {
  return HTTP_ERROR_MESSAGES[status]
    ?? 'Не удалось связаться с консультантом. Попробуйте ещё раз.'
}

function mergeProducts(
  current: AssistantProductCard[] | undefined,
  incoming: AssistantProductCard[],
): AssistantProductCard[] {
  const byId = new Map<number, AssistantProductCard>()
  for (const item of current ?? []) {
    byId.set(item.id, item)
  }
  for (const item of incoming) {
    byId.set(item.id, item)
  }
  return [...byId.values()]
}

function toClientMessages(messages: readonly AssistantChatMessage[]): AssistantClientMessage[] {
  const recent = messages.slice(-ASSISTANT_MAX_MESSAGES)
  return recent.map((message) => {
    const content = message.content
      .slice(0, ASSISTANT_MAX_CONTENT_LENGTH)
      .trim()
    const base: AssistantClientMessage = {
      role: message.role,
      content: content.length > 0 ? content : '…',
    }
    if (message.role === 'assistant' && message.products !== undefined && message.products.length > 0) {
      base.shown = message.products.slice(0, ASSISTANT_MAX_SHOWN).map(product => ({
        id: product.id,
        title: product.title,
      }))
    }
    return base
  })
}

/** Not in useState — AbortController must stay on the client. */
let activeAbort: AbortController | null = null

export function useAssistant() {
  const messages = useState<AssistantChatMessage[]>('assistant-messages', () => [])
  const loading = useState<boolean>('assistant-loading', () => false)
  const error = useState<string | null>('assistant-error', () => null)
  const status = useState<string>('assistant-status', () => '')

  function handleEvent(event: AssistantEvent, assistantIndex: number): void {
    const cart = useCartStore()
    const list = messages.value
    const target = list[assistantIndex]
    if (target === undefined || target.role !== 'assistant') {
      return
    }

    switch (event.type) {
      case 'text': {
        const next = [...list]
        next[assistantIndex] = {
          ...target,
          content: `${target.content}${event.delta}`,
        }
        messages.value = next
        break
      }
      case 'products': {
        const next = [...list]
        next[assistantIndex] = {
          ...target,
          products: mergeProducts(target.products, event.items),
        }
        messages.value = next
        break
      }
      case 'cart_add': {
        cart.addItem(event.item, event.quantity)
        status.value = 'Добавлено в корзину'
        break
      }
      case 'error': {
        error.value = event.message
        break
      }
    }
  }

  function stop(): void {
    activeAbort?.abort()
    activeAbort = null
    loading.value = false
  }

  function reset(): void {
    stop()
    messages.value = []
    error.value = null
    status.value = ''
  }

  async function streamResponse(
    response: Response,
    assistantIndex: number,
  ): Promise<void> {
    if (response.body === null) {
      error.value = 'Пустой ответ консультанта.'
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const parser = createNdjsonLineParser((line) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(line) as unknown
      }
      catch {
        return
      }
      const event = parseAssistantEvent(parsed)
      if (event !== undefined) {
        handleEvent(event, assistantIndex)
      }
    })

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      parser.push(decoder.decode(value, { stream: true }))
    }
    parser.push(decoder.decode())
    parser.flush()
  }

  async function requestCompletion(): Promise<void> {
    if (loading.value) {
      return
    }

    error.value = null
    status.value = ''
    loading.value = true

    const assistantMessage: AssistantChatMessage = {
      id: messageId(),
      role: 'assistant',
      content: '',
      products: [],
    }
    messages.value = [...messages.value, assistantMessage]
    const assistantIndex = messages.value.length - 1

    const controller = new AbortController()
    activeAbort = controller

    const body: AssistantRequest = {
      messages: toClientMessages(
        messages.value.filter((_, index) => index !== assistantIndex),
      ),
    }

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/x-ndjson',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!response.ok) {
        error.value = httpErrorMessage(response.status)
        return
      }

      await streamResponse(response, assistantIndex)
    }
    catch (caught: unknown) {
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        return
      }
      if (caught instanceof Error && caught.name === 'AbortError') {
        return
      }
      error.value = 'Не удалось связаться с консультантом. Попробуйте ещё раз.'
    }
    finally {
      if (activeAbort === controller) {
        activeAbort = null
      }
      loading.value = false

      const current = messages.value[assistantIndex]
      if (
        current !== undefined
        && current.role === 'assistant'
        && current.content.trim() === ''
        && (current.products === undefined || current.products.length === 0)
        && error.value !== null
      ) {
        messages.value = messages.value.filter((_, index) => index !== assistantIndex)
      }
    }
  }

  async function send(text: string): Promise<void> {
    const content = text.trim().slice(0, ASSISTANT_MAX_CONTENT_LENGTH)
    if (content.length === 0 || loading.value) {
      return
    }

    messages.value = [
      ...messages.value,
      {
        id: messageId(),
        role: 'user',
        content,
      },
    ]
    await requestCompletion()
  }

  async function retry(): Promise<void> {
    if (loading.value) {
      return
    }

    const list = messages.value
    let lastUserIndex = -1
    for (let index = list.length - 1; index >= 0; index -= 1) {
      if (list[index]?.role === 'user') {
        lastUserIndex = index
        break
      }
    }
    if (lastUserIndex === -1) {
      return
    }

    messages.value = list.slice(0, lastUserIndex + 1)
    error.value = null
    await requestCompletion()
  }

  return {
    messages,
    loading,
    error,
    status,
    send,
    stop,
    reset,
    retry,
  }
}
