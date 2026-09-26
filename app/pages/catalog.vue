<script setup lang="ts">
import type { Category, ProductsResponse } from '#shared/types/product'
import type { ProductSortField, SortOrder } from '#shared/types/filter'

useSeoMeta({
  title: 'Каталог товаров',
  description: 'Каталог товаров с поиском, фильтром по категории и сортировкой.',
  ogTitle: 'Каталог товаров',
  ogDescription: 'Каталог товаров с поиском, фильтром по категории и сортировкой.',
})

const {
  category,
  sortBy,
  order,
  page,
  queryParams,
  resetFilters,
} = useCatalogFilter()

const { data: categories, status: categoriesStatus } = await useFetch<Category[]>('/api/categories')

const { data, status } = await useFetch<ProductsResponse>('/api/products', {
  query: queryParams,
})

const products = computed(() => data.value?.products ?? [])

const hasNextPage = computed(() => {
  if (!data.value) {
    return false
  }
  return data.value.skip + data.value.products.length < data.value.total
})

function onSortByChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value === 'title' || value === 'price' || value === 'rating') {
    sortBy.value = value
    return
  }
  sortBy.value = undefined
}

function onOrderChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value === 'asc' || value === 'desc') {
    order.value = value
    return
  }
  order.value = undefined
}

const sortByValue = computed(() => sortBy.value ?? '')
const orderValue = computed(() => order.value ?? '')

const sortFieldLabels: Record<ProductSortField, string> = {
  title: 'Названию',
  price: 'Цене',
  rating: 'Рейтингу',
}

const orderLabels: Record<SortOrder, string> = {
  asc: 'По возрастанию',
  desc: 'По убыванию',
}
</script>

<template>
  <div class="space-y-8">
    <header class="space-y-2">
      <h1 class="text-3xl font-semibold tracking-tight">
        Каталог
      </h1>
      <p class="text-muted-foreground">
        Поиск, категории и сортировка.
      </p>
    </header>

    <div class="grid gap-8 lg:grid-cols-[16rem_1fr]">
      <aside
        class="space-y-6 rounded-xl border border-border/60 bg-card p-4"
        aria-label="Фильтры каталога"
      >
        <div class="space-y-2">
          <h2 class="text-sm font-semibold">
            Категории
          </h2>
          <div
            v-if="categoriesStatus === 'pending'"
            class="space-y-2"
          >
            <Skeleton
              v-for="index in 6"
              :key="index"
              class="h-9 w-full"
            />
          </div>
          <div
            v-else
            class="flex flex-col gap-1"
          >
            <Button
              type="button"
              variant="ghost"
              class="justify-start"
              :aria-pressed="category === ''"
              @click="category = ''"
            >
              Все
            </Button>
            <Button
              v-for="item in categories"
              :key="item.slug"
              type="button"
              variant="ghost"
              class="justify-start"
              :aria-pressed="category === item.slug"
              @click="category = item.slug"
            >
              {{ item.name }}
            </Button>
          </div>
        </div>

        <div class="space-y-2">
          <h2 class="text-sm font-semibold">
            Сортировка
          </h2>
          <label
            class="block space-y-1 text-sm"
            for="catalog-sort-by"
          >
            <span>Поле</span>
            <select
              id="catalog-sort-by"
              class="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              :value="sortByValue"
              @change="onSortByChange"
            >
              <option value="">
                По умолчанию
              </option>
              <option
                v-for="(label, field) in sortFieldLabels"
                :key="field"
                :value="field"
              >
                {{ label }}
              </option>
            </select>
          </label>
          <label
            class="block space-y-1 text-sm"
            for="catalog-order"
          >
            <span>Порядок</span>
            <select
              id="catalog-order"
              class="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              :value="orderValue"
              @change="onOrderChange"
            >
              <option value="">
                По умолчанию
              </option>
              <option
                v-for="(label, value) in orderLabels"
                :key="value"
                :value="value"
              >
                {{ label }}
              </option>
            </select>
          </label>
        </div>
      </aside>

      <div class="space-y-6">
        <div
          v-if="status === 'pending'"
          class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:grid-cols-4"
        >
          <Skeleton
            v-for="index in 8"
            :key="index"
            class="min-h-[22rem] w-full rounded-xl"
          />
        </div>

        <div
          v-else-if="products.length > 0"
          class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:grid-cols-4"
        >
          <ProductCard
            v-for="product in products"
            :key="product.id"
            :product="product"
          />
        </div>

        <div
          v-else
          class="flex min-h-[22rem] flex-col items-start justify-center gap-4 rounded-lg border border-border p-6"
        >
          <p>Ничего не найдено.</p>
          <Button
            type="button"
            @click="resetFilters()"
          >
            Сбросить фильтры
          </Button>
        </div>

        <nav
          v-if="status !== 'pending' && products.length > 0"
          class="flex items-center justify-between gap-3"
          aria-label="Страницы каталога"
        >
          <Button
            type="button"
            variant="outline"
            :disabled="page <= 1"
            @click="page = page - 1"
          >
            Назад
          </Button>
          <p class="text-sm text-muted-foreground">
            Страница {{ page }}
          </p>
          <Button
            type="button"
            variant="outline"
            :disabled="!hasNextPage"
            @click="page = page + 1"
          >
            Вперёд
          </Button>
        </nav>
      </div>
    </div>
  </div>
</template>
