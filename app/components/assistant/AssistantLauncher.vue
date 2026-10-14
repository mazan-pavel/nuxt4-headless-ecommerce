<script setup lang="ts">
import { MessageCircle } from '@lucide/vue'

defineOptions({
  inheritAttrs: false,
})

const emit = defineEmits<{
  open: []
}>()
</script>

<template>
  <Button
    type="button"
    size="icon-lg"
    class="fixed bottom-4 right-4 z-40 size-12 rounded-full shadow-lg active:scale-[0.98]"
    aria-label="Открыть консультанта Atelier"
    @click="emit('open')"
  >
    <MessageCircle
      class="size-5"
      aria-hidden="true"
    />
  </Button>
</template>
