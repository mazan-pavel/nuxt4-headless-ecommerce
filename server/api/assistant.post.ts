import type { H3Event } from 'h3'
import OpenAI, { APIUserAbortError } from 'openai'
import type {
  ChatCompletionChunk,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions'
import { DEFAULT_SITE_URL, SITE_NAME } from '#shared/config/site'
import type { AssistantEvent, AssistantRequest } from '#shared/types/assistant'
import {
  ASSISTANT_MAX_ITERATIONS,
  ASSISTANT_MAX_TOKENS,
  OPENROUTER_BASE_URL,
} from '../utils/assistant-config'
import { parseAssistantRequest } from '../utils/assistant-input'
import { ASSISTANT_SYSTEM_PROMPT } from '../utils/assistant-prompt'
import {
  inferForcedSearchArgs,
  lastUserText,
  latestShown,
  rewriteFinalAssistantText,
  sanitizeAssistantText,
  tryGroundedTurn,
} from '../utils/assistant-grounding'
import { createShownNoteFilter, formatShownNote } from '../utils/assistant-text'
import { enforceAssistantRateLimit } from '../utils/assistant-rate-limit'
import { ASSISTANT_TOOLS, runAssistantTool } from '../utils/assistant-tools'

interface PendingToolCall {
  id: string
  name: string
  arguments: string
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value !== undefined && value !== '' ? value : undefined
}

function missingConfigMessage(): string | undefined {
  const missing: string[] = []
  if (readEnv('OPENROUTER_API_KEY') === undefined) {
    missing.push('OPENROUTER_API_KEY')
  }
  if (readEnv('OPENROUTER_MODEL') === undefined) {
    missing.push('OPENROUTER_MODEL')
  }
  if (missing.length === 0) {
    return undefined
  }
  const verb = missing.length === 1 ? 'не задан' : 'не заданы'
  return `Консультант не настроен: ${verb} ${missing.join(' и ')}.`
}

function toModelMessages(request: AssistantRequest): ChatCompletionMessageParam[] {
  return request.messages.map((message) => {
    if (message.role === 'assistant' && message.shown !== undefined && message.shown.length > 0) {
      return {
        role: 'assistant',
        content: `${message.content}\n${formatShownNote(message.shown)}`,
      }
    }
    return {
      role: message.role,
      content: message.content,
    }
  })
}

function clientDisconnectSignal(event: H3Event): AbortSignal {
  const controller = new AbortController()
  event.node.res.on('close', () => {
    if (!event.node.res.writableEnded) {
      controller.abort()
    }
  })
  return controller.signal
}

function isAbortError(error: unknown): boolean {
  return error instanceof APIUserAbortError
    || (error instanceof Error && error.name === 'AbortError')
}

function logUpstreamFailure(error: unknown): void {
  const status = typeof error === 'object' && error !== null && 'status' in error
    ? error.status
    : undefined
  console.error('assistant upstream failed', typeof status === 'number' ? status : '')
}

type DeltaToolCall = ChatCompletionChunk.Choice.Delta.ToolCall

const TOOL_NAME_RE = /\b(search_products|get_product|add_to_cart)\b/i
const TRUNCATED_SEARCH_RE = /\b[a-z]{0,8}(?:search_products|_products)\b/i

/** Ollama/small models sometimes dump tool names+JSON into content instead of tool_calls. */
function isToolInvocationDump(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length === 0) {
    return false
  }
  if (/<nil>/.test(trimmed)) {
    return true
  }
  if (/DummyJSON slug|max_price keeps items|Atelier catalog before recommending/i.test(trimmed)) {
    return true
  }
  if (TOOL_NAME_RE.test(trimmed) && trimmed.includes('{')) {
    return true
  }
  // Truncated names like "earch_products {..."
  if (TRUNCATED_SEARCH_RE.test(trimmed) && trimmed.includes('{')) {
    return true
  }
  return false
}

function extractJsonObject(text: string, fromIndex: number): string | undefined {
  const start = text.indexOf('{', fromIndex)
  if (start < 0) {
    return undefined
  }
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]
    if (inString) {
      if (escape) {
        escape = false
      }
      else if (ch === '\\') {
        escape = true
      }
      else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') {
      depth += 1
    }
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        const slice = text.slice(start, i + 1)
        try {
          JSON.parse(slice)
          return slice
        }
        catch {
          return undefined
        }
      }
    }
  }
  return undefined
}

/** Recover a tool call when the model wrote it as plain text instead of tool_calls. */
function tryRecoverToolCallsFromDump(
  text: string,
): Array<{ id: string; name: string; arguments: string }> | undefined {
  const trimmed = text.trim()
  const named = trimmed.match(TOOL_NAME_RE)
  const toolName = named?.[1]
  if (named !== null && named.index !== undefined && toolName !== undefined) {
    const args = extractJsonObject(trimmed, named.index)
    if (args !== undefined) {
      return [{
        id: 'recovered_0',
        name: toolName.toLowerCase(),
        arguments: args,
      }]
    }
  }
  if (TRUNCATED_SEARCH_RE.test(trimmed)) {
    const args = extractJsonObject(trimmed, 0)
    if (args !== undefined) {
      return [{
        id: 'recovered_0',
        name: 'search_products',
        arguments: args,
      }]
    }
  }
  return undefined
}

function accumulateToolCall(pending: Map<number, PendingToolCall>, call: DeltaToolCall): void {
  const current = pending.get(call.index) ?? { id: '', name: '', arguments: '' }
  if (call.id) {
    current.id = call.id
  }
  if (call.function?.name) {
    current.name += call.function.name
  }
  if (call.function?.arguments) {
    current.arguments += call.function.arguments
  }
  pending.set(call.index, current)
}

async function runAssistant(
  request: AssistantRequest,
  model: string,
  client: OpenAI,
  emit: (payload: AssistantEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  // Weak local models invent SKUs and fake cart adds — ground those turns first.
  if (await tryGroundedTurn(request, emit)) {
    return
  }

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: ASSISTANT_SYSTEM_PROMPT },
    ...toModelMessages(request),
  ]
  const cartAdds: Array<{ title: string; quantity: number }> = []
  let searched = false

  for (let iteration = 0; iteration < ASSISTANT_MAX_ITERATIONS; iteration += 1) {
    if (signal.aborted) {
      return
    }

    const completion = await client.chat.completions.create({
      model,
      messages,
      tools: ASSISTANT_TOOLS,
      tool_choice: 'auto',
      max_tokens: ASSISTANT_MAX_TOKENS,
      stream: true,
    }, { signal })

    const filter = createShownNoteFilter()
    const pending = new Map<number, PendingToolCall>()
    let assistantText = ''
    // Buffer content until the turn ends so we can drop tool-call dumps from Ollama.
    let rawContent = ''

    for await (const chunk of completion) {
      if (signal.aborted) {
        return
      }
      const delta = chunk.choices[0]?.delta
      if (delta?.content) {
        rawContent += delta.content
      }
      for (const call of delta?.tool_calls ?? []) {
        accumulateToolCall(pending, call)
      }
    }

    const cleanedContent = `${filter.push(rawContent)}${filter.flush()}`
    let toolCalls = [...pending.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([, call], index) => ({
        id: call.id !== '' ? call.id : `tool_${iteration}_${index}`,
        name: call.name,
        arguments: call.arguments,
      }))

    const suppressedDump = isToolInvocationDump(cleanedContent)
    if (toolCalls.length === 0 && suppressedDump) {
      const recovered = tryRecoverToolCallsFromDump(cleanedContent)
      if (recovered !== undefined) {
        toolCalls = recovered
      }
    }

    // Force catalog search when the model skips tools and invents products.
    let forcedSearch = false
    if (toolCalls.length === 0 && iteration === 0 && !suppressedDump) {
      const forcedArgs = inferForcedSearchArgs(lastUserText(request))
      if (forcedArgs !== undefined) {
        toolCalls = [{
          id: 'forced_search_0',
          name: 'search_products',
          arguments: JSON.stringify(forcedArgs),
        }]
        forcedSearch = true
      }
    }

    if (toolCalls.length === 0) {
      const rewritten = rewriteFinalAssistantText({
        text: suppressedDump ? '' : cleanedContent,
        cartAdds,
        searched,
        shownTitles: latestShown(request).map(item => item.title),
      })
      if (rewritten.trim().length > 0) {
        assistantText = rewritten
        emit({ type: 'text', delta: rewritten })
      }
      if (assistantText.trim().length === 0) {
        emit({
          type: 'error',
          message: suppressedDump
            ? 'Консультант сбойнул на вызове инструмента. Сформулируйте запрос ещё раз.'
            : 'Консультант не прислал ответ. Попробуйте ещё раз.',
        })
      }
      return
    }

    // With pending tools, only keep non-dump preamble (never emit invented text before a forced search).
    if (!forcedSearch && !suppressedDump && cleanedContent.length > 0 && !isToolInvocationDump(cleanedContent)) {
      const preamble = sanitizeAssistantText(cleanedContent)
      if (preamble.length > 0) {
        assistantText = preamble
        emit({ type: 'text', delta: preamble })
      }
    }

    if (iteration === ASSISTANT_MAX_ITERATIONS - 1) {
      emit({
        type: 'error',
        message: 'Не удалось завершить ответ. Уточните запрос.',
      })
      return
    }

    messages.push({
      role: 'assistant',
      content: assistantText.length > 0 ? assistantText : null,
      tool_calls: toolCalls.map(call => ({
        id: call.id,
        type: 'function' as const,
        function: {
          name: call.name,
          arguments: call.arguments !== '' ? call.arguments : '{}',
        },
      })),
    })

    for (const call of toolCalls) {
      if (signal.aborted) {
        return
      }
      const result = await runAssistantTool(call.name, call.arguments)
      if (call.name === 'search_products') {
        searched = true
      }
      if (call.name === 'add_to_cart') {
        const fm = result.forModel
        const rec = typeof fm === 'object' && fm !== null ? fm as Record<string, unknown> : undefined
        if (rec?.ok === true && typeof rec.title === 'string') {
          cartAdds.push({
            title: rec.title,
            quantity: typeof rec.quantity === 'number' ? rec.quantity : 1,
          })
        }
      }
      for (const event of result.events) {
        emit(event)
      }
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result.forModel),
      })
    }
  }
}

export default defineEventHandler(async (event) => {
  // Nitro 2.13 deploys one Node function with response streaming and no
  // per-route maxDuration. Vercel's default of 300s covers four tool rounds.
  const unavailable = missingConfigMessage()
  if (unavailable !== undefined) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Service Unavailable',
      message: unavailable,
    })
  }

  const rate = await enforceAssistantRateLimit(event)
  if (!rate.ok) {
    throw createError({
      statusCode: rate.statusCode,
      statusMessage: rate.statusCode === 429
        ? 'Too Many Requests'
        : 'Service Unavailable',
      message: rate.message,
    })
  }

  const request = parseAssistantRequest(await readBody(event))
  if (request === undefined) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Некорректный запрос к консультанту.',
    })
  }

  const apiKey = readEnv('OPENROUTER_API_KEY')
  const model = readEnv('OPENROUTER_MODEL')
  if (apiKey === undefined || model === undefined) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Service Unavailable',
      message: 'Консультант не настроен.',
    })
  }

  const baseURL = readEnv('OPENROUTER_BASE_URL') ?? OPENROUTER_BASE_URL
  const client = new OpenAI({
    apiKey,
    baseURL,
    maxRetries: 0,
    defaultHeaders: {
      'HTTP-Referer': readEnv('NUXT_PUBLIC_SITE_URL') ?? DEFAULT_SITE_URL,
      'X-Title': SITE_NAME,
    },
  })

  setResponseHeader(event, 'Content-Type', 'application/x-ndjson; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'no-cache, no-store')
  setResponseHeader(event, 'X-Accel-Buffering', 'no')

  const signal = clientDisconnectSignal(event)
  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (payload: AssistantEvent) => {
        if (closed || signal.aborted) {
          return
        }
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`))
        }
        catch {
          closed = true
        }
      }

      try {
        await runAssistant(request, model, client, emit, signal)
      }
      catch (error: unknown) {
        if (!isAbortError(error) && !signal.aborted) {
          logUpstreamFailure(error)
          emit({
            type: 'error',
            message: 'Не удалось получить ответ консультанта.',
          })
        }
      }
      finally {
        closed = true
        try {
          controller.close()
        }
        catch {
          // The client already went away.
        }
      }
    },
  })

  return sendStream(event, stream)
})
