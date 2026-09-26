<script setup lang="ts">
import type { Category, ProductsResponse } from '#shared/types/product'
import CategoryCard from '~/components/catalog/CategoryCard.vue'

interface CategoryTile {
  category: Category
  thumbnail: string | null
}

useSeoMeta({
  title: 'Atelier | Главная',
  description: 'Atelier — тихая витрина: категории, поиск и корзина. Учебный кейс на Nuxt 4.',
  ogTitle: 'Atelier | Главная',
  ogDescription: 'Atelier — тихая витрина: категории, поиск и корзина. Учебный кейс на Nuxt 4.',
})

const { data: categories } = await useFetch<Category[]>('/api/categories')

const { data: popular, status: popularStatus } = await useFetch<ProductsResponse>('/api/products', {
  query: {
    limit: 4,
    sortBy: 'rating',
    order: 'desc',
  },
})

const popularProducts = computed(() => popular.value?.products ?? [])
const heroProduct = computed(() => popularProducts.value[0] ?? null)

const { data: categoryTiles, status: categoryTilesStatus } = await useAsyncData(
  'home-category-tiles',
  async (): Promise<CategoryTile[]> => {
    const featured = (categories.value ?? []).slice(0, 8)

    return Promise.all(
      featured.map(async (category): Promise<CategoryTile> => {
        const response = await $fetch<ProductsResponse>('/api/products', {
          query: {
            category: category.slug,
            limit: 1,
          },
        })

        return {
          category,
          thumbnail: response.products[0]?.thumbnail ?? null,
        }
      }),
    )
  },
)
</script>

<template>
  <div class="space-y-12">
    <section
      class="space-y-4"
      aria-labelledby="hero-heading"
    >
      <div class="grid items-center gap-8 md:grid-cols-2 md:gap-10 lg:gap-12">
        <div class="space-y-5">
          <p class="text-sm font-medium tracking-wide text-muted-foreground">
            Atelier
          </p>
          <h1
            id="hero-heading"
            class="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl"
          >
            Магазин без лишнего шума
          </h1>
          <p class="max-w-md text-muted-foreground">
            Каталог, поиск и корзина — спокойная витрина для повседневных вещей.
          </p>
          <Button
            as-child
            class="rounded-lg active:scale-[0.98]"
          >
            <NuxtLink to="/catalog">
              Перейти в каталог
            </NuxtLink>
          </Button>
        </div>

        <div class="min-w-0">
          <Skeleton
            v-if="popularStatus === 'pending' || !heroProduct"
            class="aspect-[4/5] w-full rounded-2xl"
          />
          <div
            v-else
            class="aspect-[4/5] overflow-hidden rounded-2xl bg-muted"
          >
            <NuxtImg
              :src="heroProduct.thumbnail"
              :alt="heroProduct.title"
              width="640"
              height="800"
              fit="cover"
              sizes="sm:100vw md:50vw"
              preload
              fetchpriority="high"
              class="size-full object-cover"
            />
          </div>
        </div>
      </div>
      <p class="text-xs text-muted-foreground">
        Учебный кейс на Nuxt 4
      </p>
    </section>

    <section
      class="space-y-4"
      aria-labelledby="categories-heading"
    >
      <h2
        id="categories-heading"
        class="text-2xl font-semibold tracking-tight"
      >
        Категории
      </h2>
      <div
        v-if="categoryTilesStatus === 'pending'"
        class="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4"
      >
        <Skeleton
          v-for="index in 8"
          :key="index"
          class="aspect-[4/3] w-full rounded-xl"
        />
      </div>
      <template v-else>
        <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
          <li
            v-for="tile in categoryTiles"
            :key="tile.category.slug"
          >
            <CategoryCard
              :category="tile.category"
              :image="tile.thumbnail"
            />
          </li>
        </ul>
        <p>
          <NuxtLink
            to="/catalog"
            class="text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Все категории
          </NuxtLink>
        </p>
      </template>
    </section>

    <section
      class="space-y-4"
      aria-labelledby="popular-heading"
    >
      <h2
        id="popular-heading"
        class="text-2xl font-semibold tracking-tight"
      >
        Популярные товары
      </h2>
      <div
        v-if="popularStatus === 'pending'"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:grid-cols-4"
      >
        <Skeleton
          v-for="index in 4"
          :key="index"
          class="min-h-[22rem] w-full rounded-xl"
        />
      </div>
      <div
        v-else
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:grid-cols-4"
      >
        <ProductCard
          v-for="(product, index) in popularProducts"
          :key="product.id"
          :product="product"
          :preload="index === 0"
        />
      </div>
    </section>
  </div>
</template>
