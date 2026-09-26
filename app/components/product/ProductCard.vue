<script setup lang="ts">
import type { Product } from '#shared/types/product'

const props = withDefaults(defineProps<{
  product: Product
  preload?: boolean
}>(), {
  preload: false,
})

const cart = useCartStore()

const money = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'USD',
})

const discountedPrice = computed(() =>
  props.product.price * (1 - props.product.discountPercentage / 100),
)

const discountLabel = computed(() =>
  `−${Math.round(props.product.discountPercentage)}%`,
)

const cartQuantity = computed(() =>
  cart.items.find(item => item.id === props.product.id)?.quantity ?? 0,
)

const cannotAdd = computed(() =>
  props.product.stock < 1 || cartQuantity.value >= props.product.stock,
)

function addToCart() {
  cart.addItem(props.product)
}
</script>

<template>
  <article class="group flex min-h-[22rem] flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition-colors duration-200 ease-out hover:border-border">
    <NuxtLink
      :to="`/product/${product.id}`"
      class="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div class="relative aspect-square overflow-hidden bg-muted">
        <NuxtImg
          :src="product.thumbnail"
          :alt="product.title"
          width="400"
          height="400"
          fit="cover"
          sizes="sm:100vw md:50vw lg:25vw"
          :loading="preload ? undefined : 'lazy'"
          :preload="preload"
          :fetchpriority="preload ? 'high' : undefined"
          class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <span
          v-if="product.discountPercentage > 0"
          class="absolute left-3 top-3 rounded-md border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
        >
          {{ discountLabel }}
        </span>
      </div>
      <p class="line-clamp-1 px-4 pt-4 text-base font-medium text-foreground">
        {{ product.title }}
      </p>
    </NuxtLink>

    <div class="mt-auto space-y-3 p-4">
      <div class="space-y-1">
        <p class="flex flex-wrap items-baseline gap-2">
          <span class="font-semibold text-foreground">{{ money.format(discountedPrice) }}</span>
          <span
            v-if="product.discountPercentage > 0"
            class="text-sm text-muted-foreground line-through"
          >
            {{ money.format(product.price) }}
          </span>
        </p>
        <p class="text-xs text-muted-foreground">
          Рейтинг {{ product.rating.toFixed(1) }}
        </p>
      </div>
      <div class="min-h-9">
        <Button
          type="button"
          class="w-full rounded-lg transition-opacity duration-200 ease-out active:scale-[0.98] lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
          :disabled="cannotAdd"
          @click="addToCart"
        >
          В корзину
        </Button>
      </div>
    </div>
  </article>
</template>
