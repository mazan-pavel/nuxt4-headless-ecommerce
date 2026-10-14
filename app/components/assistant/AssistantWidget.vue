<script setup lang="ts">
const open = ref(false)

function openPanel(): void {
  open.value = true
}
</script>

<template>
  <div>
    <AssistantLauncher
      v-show="!open"
      @open="openPanel"
    />
    <AssistantPanel v-model:open="open" />
  </div>
</template>
