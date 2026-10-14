<script setup lang="ts">
import type { AssistantProductCard } from '#shared/types/assistant'

const props = defineProps<{
  product: AssistantProductCard
}>()

const cart = useCartStore()

const money = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'USD',
})

const discountedPrice = computed(() =>
  props.product.price * (1 - props.product.discountPercentage / 100),
)

const cartQuantity = computed(() =>
  cart.items.find(item => item.id === props.product.id)?.quantity ?? 0,
)

const cannotAdd = computed(() =>
  props.product.stock < 1 || cartQuantity.value >= props.product.stock,
)

function addToCart(): void {
  cart.addItem(props.product)
}
</script>

<template>
  <article class="overflow-hidden rounded-xl border border-border/60 bg-card">
    <NuxtLink
      :to="`/product/${product.id}`"
      class="flex gap-3 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span class="block size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        <NuxtImg
          :src="product.thumbnail"
          :alt="product.title"
          width="64"
          height="64"
          fit="cover"
          sizes="64px"
          loading="lazy"
          class="size-full object-cover"
        />
      </span>
      <div class="min-w-0 flex-1 space-y-1">
        <p class="line-clamp-2 text-sm font-medium text-foreground">
          {{ product.title }}
        </p>
        <p class="flex flex-wrap items-baseline gap-2 text-sm">
          <span class="font-semibold">{{ money.format(discountedPrice) }}</span>
          <span
            v-if="product.discountPercentage > 0"
            class="text-xs text-muted-foreground line-through"
          >
            {{ money.format(product.price) }}
          </span>
        </p>
        <p class="text-xs text-muted-foreground">
          Рейтинг {{ product.rating.toFixed(1) }}
        </p>
      </div>
    </NuxtLink>
    <div class="border-t border-border/50 px-3 py-2">
      <Button
        type="button"
        size="sm"
        class="w-full rounded-lg active:scale-[0.98]"
        :disabled="cannotAdd"
        @click="addToCart"
      >
        В корзину
      </Button>
    </div>
  </article>
</template>
