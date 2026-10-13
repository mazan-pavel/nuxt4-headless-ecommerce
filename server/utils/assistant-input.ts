import { z } from 'zod'
import {
  ASSISTANT_MAX_CONTENT_LENGTH,
  ASSISTANT_MAX_MESSAGES,
  ASSISTANT_MAX_SHOWN,
} from '#shared/config/assistant'
import type { AssistantRequest } from '#shared/types/assistant'

const shownProductSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().trim().min(1).max(200),
})

const messageSchema = z.object({
  role: z.string().trim().toLowerCase().pipe(z.enum(['user', 'assistant'])),
  content: z.string().max(ASSISTANT_MAX_CONTENT_LENGTH).trim().min(1),
  shown: z.array(shownProductSchema).max(ASSISTANT_MAX_SHOWN).optional(),
})

export const assistantRequestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(ASSISTANT_MAX_MESSAGES),
})

export function parseAssistantRequest(body: unknown): AssistantRequest | undefined {
  const parsed = assistantRequestSchema.safeParse(body)
  if (!parsed.success) {
    return undefined
  }
  return {
    messages: parsed.data.messages.map(message => ({
      role: message.role,
      content: message.content,
      ...(message.shown !== undefined && message.shown.length > 0
        ? { shown: message.shown }
        : {}),
    })),
  }
}
