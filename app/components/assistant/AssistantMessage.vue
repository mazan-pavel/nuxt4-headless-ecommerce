<script setup lang="ts">
import type { AssistantChatMessage } from '#shared/types/assistant'

defineProps<{
  message: AssistantChatMessage
}>()

interface TextSegment {
  bold: boolean
  text: string
}

function parseInline(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  const pattern = /\*\*([^*]+)\*\*/g
  let lastIndex = 0
  let match = pattern.exec(text)

  while (match !== null) {
    if (match.index > lastIndex) {
      segments.push({ bold: false, text: text.slice(lastIndex, match.index) })
    }
    segments.push({ bold: true, text: match[1] ?? '' })
    lastIndex = match.index + match[0].length
    match = pattern.exec(text)
  }

  if (lastIndex < text.length) {
    segments.push({ bold: false, text: text.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ bold: false, text }]
}

function paragraphs(content: string): string[] {
  return content.split(/\n+/).filter(part => part.length > 0)
}
</script>

<template>
  <div
    class="flex"
    :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
  >
    <div
      class="max-w-[90%] space-y-2 rounded-xl px-3 py-2 text-sm"
      :class="message.role === 'user'
        ? 'bg-primary text-primary-foreground'
        : 'border border-border/60 bg-card text-foreground'"
    >
      <div
        v-if="message.content.trim().length > 0"
        class="space-y-2 break-words"
      >
        <p
          v-for="(paragraph, index) in paragraphs(message.content)"
          :key="`${message.id}-${index}`"
        >
          <template
            v-for="(segment, segmentIndex) in parseInline(paragraph)"
            :key="`${message.id}-${index}-${segmentIndex}`"
          >
            <strong
              v-if="segment.bold"
              class="font-semibold"
            >{{ segment.text }}</strong>
            <template v-else>{{ segment.text }}</template>
          </template>
        </p>
      </div>

      <ul
        v-if="message.products !== undefined && message.products.length > 0"
        class="space-y-2"
      >
        <li
          v-for="product in message.products"
          :key="product.id"
        >
          <AssistantProductCard :product="product" />
        </li>
      </ul>
    </div>
  </div>
</template>
