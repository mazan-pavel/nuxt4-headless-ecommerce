<script setup lang="ts">
import { Eraser, SendHorizontal, Square } from '@lucide/vue'
import { ASSISTANT_MAX_CONTENT_LENGTH } from '#shared/config/assistant'

const open = defineModel<boolean>('open', { required: true })

const {
  messages,
  loading,
  error,
  status,
  send,
  stop,
  reset,
  retry,
} = useAssistant()

const draft = ref('')
const inputRef = ref<HTMLTextAreaElement | null>(null)
const bottomRef = ref<HTMLElement | null>(null)

const SUGGESTIONS = [
  'Подарок маме до $30',
  'Что у вас с доставкой?',
  'Есть часы до $50?',
] as const

const isEmpty = computed(() => messages.value.length === 0)

const showTyping = computed(() => {
  if (!loading.value) {
    return false
  }
  const last = messages.value[messages.value.length - 1]
  return last?.role === 'assistant'
    && last.content.trim() === ''
    && (last.products === undefined || last.products.length === 0)
})

const canSend = computed(() =>
  draft.value.trim().length > 0 && !loading.value,
)

watch(open, async (isOpen) => {
  if (!isOpen) {
    return
  }
  await nextTick()
  inputRef.value?.focus()
  scrollToBottom()
})

watch(
  [messages, loading, status],
  async () => {
    await nextTick()
    scrollToBottom()
  },
  { deep: true },
)

function scrollToBottom(): void {
  bottomRef.value?.scrollIntoView({ block: 'end' })
}

async function submit(): Promise<void> {
  const text = draft.value.trim()
  if (text.length === 0 || loading.value) {
    return
  }
  draft.value = ''
  await send(text)
  await nextTick()
  inputRef.value?.focus()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || event.shiftKey) {
    return
  }
  event.preventDefault()
  void submit()
}

async function onSuggestion(text: string): Promise<void> {
  draft.value = ''
  await send(text)
}

function onClear(): void {
  reset()
  draft.value = ''
  void nextTick(() => inputRef.value?.focus())
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent
      side="right"
      class="flex h-full w-full flex-col gap-0 p-0 sm:max-w-md"
    >
      <SheetHeader class="shrink-0 border-b border-border px-4 py-4 text-left">
        <SheetTitle>Консультант Atelier</SheetTitle>
        <SheetDescription>
          Помогу найти товар, подсказать доставку и положить в корзину.
        </SheetDescription>
      </SheetHeader>

      <div class="flex min-h-0 flex-1 flex-col">
        <ScrollArea class="min-h-0 flex-1 px-4">
          <div
            class="space-y-3 py-4"
            aria-live="polite"
            aria-relevant="additions"
          >
            <div
              v-if="isEmpty"
              class="space-y-3"
            >
              <p class="text-sm text-muted-foreground">
                Спросите про подарок, доставку или наличие — отвечу по каталогу Atelier.
              </p>
              <ul class="flex flex-col gap-2">
                <li
                  v-for="suggestion in SUGGESTIONS"
                  :key="suggestion"
                >
                  <Button
                    type="button"
                    variant="outline"
                    class="h-auto w-full justify-start whitespace-normal rounded-lg px-3 py-2 text-left text-sm active:scale-[0.98]"
                    :disabled="loading"
                    @click="onSuggestion(suggestion)"
                  >
                    {{ suggestion }}
                  </Button>
                </li>
              </ul>
            </div>

            <AssistantMessage
              v-for="message in messages"
              :key="message.id"
              :message="message"
            />

            <div
              v-if="showTyping"
              class="flex justify-start"
              aria-label="Консультант печатает"
            >
              <div class="flex items-center gap-1 rounded-xl border border-border/60 bg-card px-3 py-2">
                <span class="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
                <span class="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
                <span class="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
              </div>
            </div>

            <p
              v-if="status"
              class="text-xs text-muted-foreground"
              aria-live="polite"
            >
              {{ status }}
            </p>

            <div
              v-if="error"
              class="space-y-2 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2"
              role="alert"
            >
              <p class="text-sm text-destructive">
                {{ error }}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="rounded-lg active:scale-[0.98]"
                :disabled="loading"
                @click="retry"
              >
                Повторить
              </Button>
            </div>

            <div ref="bottomRef" />
          </div>
        </ScrollArea>

        <div class="shrink-0 space-y-2 border-t border-border p-4">
          <div class="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="size-9 shrink-0"
              aria-label="Очистить чат"
              :disabled="isEmpty && error === null"
              @click="onClear"
            >
              <Eraser
                class="size-4"
                aria-hidden="true"
              />
            </Button>

            <label class="sr-only" for="assistant-input">
              Сообщение консультанту
            </label>
            <textarea
              id="assistant-input"
              ref="inputRef"
              v-model="draft"
              rows="2"
              :maxlength="ASSISTANT_MAX_CONTENT_LENGTH"
              :disabled="loading"
              placeholder="Напишите вопрос…"
              class="min-h-10 w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              @keydown="onKeydown"
            />

            <Button
              v-if="loading"
              type="button"
              variant="secondary"
              size="icon"
              class="size-9 shrink-0"
              aria-label="Остановить ответ"
              @click="stop"
            >
              <Square
                class="size-4"
                aria-hidden="true"
              />
            </Button>
            <Button
              v-else
              type="button"
              size="icon"
              class="size-9 shrink-0 active:scale-[0.98]"
              aria-label="Отправить сообщение"
              :disabled="!canSend"
              @click="submit"
            >
              <SendHorizontal
                class="size-4"
                aria-hidden="true"
              />
            </Button>
          </div>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
