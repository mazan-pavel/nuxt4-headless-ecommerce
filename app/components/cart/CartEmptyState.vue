<script setup lang="ts">
import { ShoppingBag } from '@lucide/vue'

defineOptions({ inheritAttrs: false })
</script>

<template>
  <div
    class="flex flex-1 flex-col items-center justify-center gap-5 px-2 py-10 text-center"
    v-bind="$attrs"
  >
    <div
      class="flex size-12 items-center justify-center rounded-xl border border-border/60 bg-muted text-muted-foreground"
      aria-hidden="true"
    >
      <ShoppingBag class="size-5" />
    </div>
    <div class="max-w-xs space-y-1.5">
      <p class="text-base font-semibold tracking-tight">
        Корзина пуста
      </p>
      <p class="text-sm text-muted-foreground">
        Добавьте товары из каталога, чтобы продолжить покупки.
      </p>
    </div>
    <slot>
      <Button
        as-child
        class="rounded-lg active:scale-[0.98]"
      >
        <NuxtLink to="/catalog">
          Перейти в каталог
        </NuxtLink>
      </Button>
    </slot>
  </div>
</template>
