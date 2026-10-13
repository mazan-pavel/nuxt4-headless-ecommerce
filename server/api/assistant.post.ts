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
import { createShownNoteFilter, formatShownNote } from '../utils/assistant-text'
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
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: ASSISTANT_SYSTEM_PROMPT },
    ...toModelMessages(request),
  ]

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

    const pushText = (delta: string) => {
      const clean = filter.push(delta)
      if (clean.length === 0) {
        return
      }
      assistantText += clean
      emit({ type: 'text', delta: clean })
    }

    for await (const chunk of completion) {
      if (signal.aborted) {
        return
      }
      const delta = chunk.choices[0]?.delta
      if (delta?.content) {
        pushText(delta.content)
      }
      for (const call of delta?.tool_calls ?? []) {
        accumulateToolCall(pending, call)
      }
    }

    const rest = filter.flush()
    if (rest.length > 0) {
      assistantText += rest
      emit({ type: 'text', delta: rest })
    }

    const toolCalls = [...pending.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([, call], index) => ({
        id: call.id !== '' ? call.id : `tool_${iteration}_${index}`,
        name: call.name,
        arguments: call.arguments,
      }))

    if (toolCalls.length === 0) {
      if (assistantText.trim().length === 0) {
        emit({
          type: 'error',
          message: 'Консультант не прислал ответ. Попробуйте ещё раз.',
        })
      }
      return
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

  const client = new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
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
