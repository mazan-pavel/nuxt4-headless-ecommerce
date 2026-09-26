<script setup lang="ts">
import type { Category, ProductsResponse } from '#shared/types/product'
import {
  HOME_FEATURED_CATEGORY_SLUGS,
  HOME_SHELF_CATEGORY,
  HOME_SHELF_TITLE,
} from '#shared/config/storefront'
import { categoryLabel } from '#shared/config/categoryLabels'

interface CategoryTile {
  category: Category
  thumbnail: string | null
}

useSeoMeta({
  title: 'Atelier | Главная',
  description: 'Atelier — тихая витрина: категории, поиск и корзина.',
  ogTitle: 'Atelier | Главная',
  ogDescription: 'Atelier — тихая витрина: категории, поиск и корзина.',
})

const { data: shelf, status: shelfStatus } = await useFetch<ProductsResponse>(
  '/api/products',
  {
    query: {
      category: HOME_SHELF_CATEGORY,
      limit: 4,
    },
  },
)

const shelfProducts = computed(() => shelf.value?.products ?? [])
const heroProduct = computed(() => shelfProducts.value[0] ?? null)

const { data: categoryTiles } = useAsyncData(
  'home-category-tiles',
  async (): Promise<CategoryTile[]> => {
    const categories = await $fetch<Category[]>('/api/categories')
    const bySlug = new Map(categories.map(category => [category.slug, category]))
    const featured: Category[] = []

    for (const slug of HOME_FEATURED_CATEGORY_SLUGS) {
      const match = bySlug.get(slug)
      if (match) {
        featured.push(match)
      }
    }

    for (const category of categories) {
      if (featured.length >= 8) {
        break
      }
      if (!featured.some(item => item.slug === category.slug)) {
        featured.push(category)
      }
    }

    const selected = featured.slice(0, 8)

    return Promise.all(
      selected.map(async (category): Promise<CategoryTile> => {
        const response = await $fetch<ProductsResponse>('/api/products', {
          query: {
            category: category.slug,
            limit: 1,
          },
        })

        return {
          category: {
            ...category,
            name: categoryLabel(category.slug, category.name),
          },
          thumbnail: response.products[0]?.thumbnail ?? null,
        }
      }),
    )
  },
  { lazy: true },
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

        <div class="order-first min-w-0 md:order-none">
          <Skeleton
            v-if="!heroProduct"
            class="aspect-[4/5] w-full rounded-2xl"
          />
          <NuxtLink
            v-else
            :to="`/product/${heroProduct.id}`"
            class="block aspect-[4/5] overflow-hidden rounded-2xl bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <NuxtImg
              :src="heroProduct.thumbnail"
              :alt="heroProduct.title"
              width="640"
              height="800"
              fit="cover"
              densities="1"
              sizes="(max-width: 768px) 100vw, 640px"
              format="webp"
              loading="eager"
              :preload="{ fetchPriority: 'high' }"
              class="size-full object-cover transition-transform duration-300 hover:scale-105"
            />
          </NuxtLink>
        </div>
      </div>
    </section>

    <section
      class="space-y-4"
      aria-labelledby="categories-heading"
    >
      <div class="flex items-baseline justify-between gap-4">
        <h2
          id="categories-heading"
          class="text-2xl font-semibold tracking-tight"
        >
          Категории
        </h2>
        <NuxtLink
          to="/catalog"
          class="shrink-0 text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Все
        </NuxtLink>
      </div>
      <div
        v-if="!categoryTiles"
        class="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4"
      >
        <Skeleton
          v-for="index in 8"
          :key="index"
          class="aspect-[4/3] w-full rounded-xl"
        />
      </div>
      <ul
        v-else
        class="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4"
      >
        <li
          v-for="tile in categoryTiles"
          :key="tile.category.slug"
        >
          <LazyCategoryCard
            :category="tile.category"
            :image="tile.thumbnail"
          />
        </li>
      </ul>
    </section>

    <section
      class="space-y-4"
      aria-labelledby="shelf-heading"
    >
      <div class="flex items-baseline justify-between gap-4">
        <h2
          id="shelf-heading"
          class="text-2xl font-semibold tracking-tight"
        >
          {{ HOME_SHELF_TITLE }}
        </h2>
        <NuxtLink
          :to="`/catalog?category=${HOME_SHELF_CATEGORY}`"
          class="shrink-0 text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Смотреть все
        </NuxtLink>
      </div>
      <div
        v-if="shelfStatus === 'pending'"
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
        <LazyProductCard
          v-for="product in shelfProducts"
          :key="product.id"
          :product="product"
        />
      </div>
    </section>
  </div>
</template>
