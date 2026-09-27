<script setup lang="ts">
import type { Product } from '#shared/types/product'
import { categoryLabel } from '#shared/config/categoryLabels'

const route = useRoute()
const cart = useCartStore()

const { data: product, error } = await useFetch<Product>(
  () => `/api/products/${String(route.params.id)}`,
)

watch(error, (value) => {
  if (!value) {
    return
  }
  const statusCode = value.statusCode
  if (statusCode === 404 || statusCode === 400) {
    throw createError({ statusCode: 404, statusMessage: 'Товар не найден' })
  }
  throw createError({
    statusCode: statusCode ?? 502,
    statusMessage: 'Не удалось загрузить товар',
  })
}, { immediate: true })

const images = computed(() => {
  const item = product.value
  if (!item) {
    return []
  }
  return item.images.length > 0 ? item.images : [item.thumbnail]
})

const activeIndex = ref(0)

watch(() => product.value?.id, () => {
  activeIndex.value = 0
})

const activeImage = computed(() => images.value[activeIndex.value] ?? product.value?.thumbnail ?? '')

const money = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'USD',
})

const discountedPrice = computed(() => {
  const item = product.value
  if (!item) {
    return 0
  }
  return item.price * (1 - item.discountPercentage / 100)
})

const quantity = ref(1)

watch(() => product.value?.id, () => {
  quantity.value = 1
})

function decrease() {
  quantity.value = Math.max(1, quantity.value - 1)
}

function increase() {
  const stock = product.value?.stock ?? 1
  quantity.value = Math.min(stock, quantity.value + 1)
}

function addToCart() {
  if (!product.value || product.value.stock < 1) {
    return
  }
  cart.addItem(product.value, quantity.value)
}

useProductWebMcpTools({
  product: () => product.value,
  quantity: () => quantity.value,
})

usePageSeo({
  title: () => product.value?.title ?? 'Товар',
  description: () => product.value?.description ?? '',
  path: () => product.value ? `/product/${product.value.id}` : undefined,
  ogImage: () => product.value?.thumbnail,
  ogType: 'product',
})

const { absoluteUrl } = useSiteUrl()

useJsonLd(() => {
  const item = product.value
  if (!item) {
    return null
  }

  const productUrl = absoluteUrl(`/product/${item.id}`)
  const price = (item.price * (1 - item.discountPercentage / 100)).toFixed(2)
  const images = item.images.length > 0 ? item.images : [item.thumbnail]

  const productSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${productUrl}#product`,
    name: item.title,
    description: item.description,
    image: images,
    sku: item.sku,
    url: productUrl,
    category: item.category,
    offers: {
      '@type': 'Offer',
      url: productUrl,
      price,
      priceCurrency: 'USD',
      availability: item.stock > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  }

  if (item.brand) {
    productSchema.brand = { '@type': 'Brand', name: item.brand }
  }

  if (item.reviews.length > 0) {
    productSchema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: item.rating.toFixed(1),
      reviewCount: String(item.reviews.length),
      bestRating: '5',
      worstRating: '1',
    }
  }

  const breadcrumb: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Главная',
        item: absoluteUrl('/'),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Каталог',
        item: absoluteUrl('/catalog'),
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: categoryLabel(item.category, item.category),
        item: absoluteUrl(`/catalog?category=${encodeURIComponent(item.category)}`),
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: item.title,
        item: productUrl,
      },
    ],
  }

  return [productSchema, breadcrumb]
})
</script>

<template>
  <div
    v-if="product"
    class="grid gap-8 lg:grid-cols-2"
  >
    <div class="space-y-3">
      <div class="aspect-square overflow-hidden rounded-xl bg-muted">
        <NuxtImg
          :src="activeImage"
          :alt="product.title"
          width="800"
          height="800"
          fit="cover"
          sizes="sm:100vw lg:50vw"
          format="webp"
          loading="eager"
          :preload="{ fetchPriority: 'high' }"
          class="size-full object-cover"
        />
      </div>
      <ul
        v-if="images.length > 1"
        class="flex gap-2"
      >
        <li
          v-for="(image, index) in images"
          :key="image"
        >
          <Button
            type="button"
            variant="ghost"
            class="h-auto w-auto overflow-hidden rounded-xl p-0"
            :class="activeIndex === index ? 'ring-2 ring-ring' : undefined"
            :aria-label="`Фото ${index + 1}: ${product.title}`"
            :aria-pressed="activeIndex === index"
            @click="activeIndex = index"
          >
            <span class="block size-20 overflow-hidden bg-muted">
              <NuxtImg
                :src="image"
                :alt="product.title"
                width="80"
                height="80"
                fit="cover"
                sizes="80px"
                loading="lazy"
                class="size-full object-cover"
              />
            </span>
          </Button>
        </li>
      </ul>
    </div>

    <div class="space-y-4">
      <h1 class="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {{ product.title }}
      </h1>
      <p class="text-muted-foreground">
        {{ product.description }}
      </p>
      <p class="flex flex-wrap items-baseline gap-2 text-lg">
        <span class="font-semibold">{{ money.format(discountedPrice) }}</span>
        <span
          v-if="product.discountPercentage > 0"
          class="text-base text-muted-foreground line-through"
        >
          {{ money.format(product.price) }}
        </span>
      </p>
      <p class="text-sm text-muted-foreground">
        В наличии: {{ product.stock }}
      </p>
      <div class="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Уменьшить количество"
          :disabled="quantity <= 1"
          @click="decrease"
        >
          <span aria-hidden="true">−</span>
        </Button>
        <span class="min-w-8 text-center">{{ quantity }}</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Увеличить количество"
          :disabled="quantity >= product.stock"
          @click="increase"
        >
          <span aria-hidden="true">+</span>
        </Button>
      </div>
      <Button
        type="button"
        class="rounded-lg active:scale-[0.98]"
        :disabled="product.stock < 1"
        @click="addToCart"
      >
        Добавить в корзину
      </Button>
    </div>
  </div>
</template>
