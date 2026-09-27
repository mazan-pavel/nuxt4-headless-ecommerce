<script setup lang="ts">
import type { Category, Product, ProductsResponse } from '#shared/types/product'
import type { ProductListQuery } from '#shared/types/filter'
import { categoryLabel } from '#shared/config/categoryLabels'
import {
  SORT_PRESETS,
  sortPresetById,
  sortPresetFromQuery,
} from '#shared/config/sortPresets'

const route = useRoute()
const { absoluteUrl } = useSiteUrl()

usePageSeo({
  title: 'Каталог товаров',
  description: 'Каталог Atelier: поиск, категории и сортировка.',
  path: () => {
    const categoryParam = route.query.category
    const slug = typeof categoryParam === 'string' ? categoryParam : ''
    return slug !== '' ? `/catalog?category=${encodeURIComponent(slug)}` : '/catalog'
  },
})

useJsonLd(() => {
  const categoryParam = route.query.category
  const slug = typeof categoryParam === 'string' ? categoryParam : ''
  const items: Array<{
    '@type': 'ListItem'
    position: number
    name: string
    item: string
  }> = [
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
  ]
  if (slug !== '') {
    items.push({
      '@type': 'ListItem',
      position: 3,
      name: categoryLabel(slug, slug),
      item: absoluteUrl(`/catalog?category=${encodeURIComponent(slug)}`),
    })
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  }
})

const {
  category,
  search,
  sortBy,
  order,
  limit,
  setSort,
  resetFilters,
} = useCatalogFilter()

const page = ref(1)
const accumulated = ref<Product[]>([])
const total = ref(0)

const listQuery = computed((): ProductListQuery => {
  const params: ProductListQuery = {
    limit: limit.value,
    skip: (page.value - 1) * limit.value,
  }

  const q = search.value.trim()
  if (q !== '') {
    params.q = q
  }
  if (category.value !== '') {
    params.category = category.value
  }
  if (sortBy.value !== undefined) {
    params.sortBy = sortBy.value
  }
  if (order.value !== undefined) {
    params.order = order.value
  }

  return params
})

const { data: categories, status: categoriesStatus } = await useFetch<Category[]>('/api/categories')

const { data, status } = await useFetch<ProductsResponse>('/api/products', {
  query: listQuery,
  watch: [listQuery],
})

watch(data, (response) => {
  if (!response) {
    return
  }

  total.value = response.total

  if (page.value === 1) {
    accumulated.value = response.products
    return
  }

  const seen = new Set(accumulated.value.map(product => product.id))
  const next = response.products.filter(product => !seen.has(product.id))
  accumulated.value = [...accumulated.value, ...next]
}, { immediate: true })

watch(
  [search, category, sortBy, order, limit],
  () => {
    page.value = 1
  },
)

const hasMore = computed(() => accumulated.value.length < total.value)
const isInitialPending = computed(
  () => status.value === 'pending' && page.value === 1,
)
const isLoadingMore = computed(
  () => status.value === 'pending' && page.value > 1,
)

const metaLabel = computed(() => {
  if (isInitialPending.value) {
    return 'Загрузка…'
  }
  if (total.value === 0) {
    return ''
  }
  return `Показано ${accumulated.value.length} из ${total.value}`
})

const sortPresetId = computed(() =>
  sortPresetFromQuery(sortBy.value, order.value),
)

function onSortPresetChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  const preset = sortPresetById(value)
  if (!preset || preset.id === 'default') {
    setSort(undefined, undefined)
    return
  }
  setSort(preset.sortBy, preset.order)
}

function clearSearch() {
  search.value = ''
}

function labelForCategory(item: Category): string {
  return categoryLabel(item.slug, item.name)
}

const router = useRouter()

if (route.query.page !== undefined) {
  const nextQuery = { ...route.query }
  delete nextQuery.page
  void router.replace({ query: nextQuery })
}

const sentinel = useTemplateRef<HTMLElement>('sentinel')

useIntersectionObserver(
  sentinel,
  ([entry]) => {
    if (!entry?.isIntersecting) {
      return
    }
    if (!hasMore.value || status.value === 'pending') {
      return
    }
    page.value += 1
  },
  { rootMargin: '200px' },
)
</script>

<template>
  <div class="space-y-6">
    <header>
      <h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">
        Каталог
      </h1>
    </header>

    <div class="sticky top-[7.25rem] z-30 -mx-4 space-y-3 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur sm:top-[3.75rem] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div
        class="flex gap-2 overflow-x-auto pb-0.5"
        role="group"
        aria-label="Категории"
      >
        <template v-if="categoriesStatus === 'pending'">
          <Skeleton
            v-for="index in 8"
            :key="index"
            class="h-9 w-24 shrink-0 rounded-lg"
          />
        </template>
        <template v-else>
          <Button
            type="button"
            class="shrink-0 rounded-lg"
            :class="category === ''
              ? 'bg-foreground text-background hover:bg-foreground/90 hover:text-background'
              : undefined"
            :variant="category === '' ? 'default' : 'ghost'"
            :aria-pressed="category === ''"
            @click="category = ''"
          >
            Все
          </Button>
          <Button
            v-for="item in categories"
            :key="item.slug"
            type="button"
            class="shrink-0 rounded-lg"
            :class="category === item.slug
              ? 'bg-foreground text-background hover:bg-foreground/90 hover:text-background'
              : undefined"
            :variant="category === item.slug ? 'default' : 'ghost'"
            :aria-pressed="category === item.slug"
            @click="category = item.slug"
          >
            {{ labelForCategory(item) }}
          </Button>
        </template>
      </div>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <Badge
            v-if="search"
            variant="secondary"
            class="gap-1.5 rounded-lg px-2.5 py-1 text-sm font-normal"
          >
            <span class="max-w-[12rem] truncate sm:max-w-xs">
              Поиск: {{ search }}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="size-5 rounded-md"
              aria-label="Очистить поиск"
              @click="clearSearch"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="size-3.5"
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </Button>
          </Badge>
          <p
            v-if="metaLabel"
            class="text-xs text-muted-foreground"
            aria-live="polite"
          >
            {{ metaLabel }}
          </p>
        </div>

        <label
          class="flex items-center gap-2 text-sm"
          for="catalog-sort-preset"
        >
          <span class="shrink-0 text-xs text-muted-foreground">Сортировка</span>
          <select
            id="catalog-sort-preset"
            class="flex h-9 min-w-[11rem] rounded-md border border-input bg-background px-3 text-sm"
            :value="sortPresetId"
            @change="onSortPresetChange"
          >
            <option
              v-for="preset in SORT_PRESETS"
              :key="preset.id"
              :value="preset.id"
            >
              {{ preset.label }}
            </option>
          </select>
        </label>
      </div>
    </div>

    <div
      v-if="isInitialPending"
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:grid-cols-4"
    >
      <Skeleton
        v-for="index in 8"
        :key="index"
        class="min-h-[22rem] w-full rounded-xl"
      />
    </div>

    <template v-else-if="accumulated.length > 0">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
        <ProductCard
          v-for="product in accumulated"
          :key="product.id"
          :product="product"
        />
      </div>

      <div
        v-if="isLoadingMore"
        class="space-y-3"
      >
        <p class="text-center text-sm text-muted-foreground">
          Подгружаем…
        </p>
        <div
          class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:grid-cols-4"
          aria-hidden="true"
        >
          <Skeleton
            v-for="index in 4"
            :key="index"
            class="min-h-[22rem] w-full rounded-xl"
          />
        </div>
      </div>

      <p
        v-else-if="!hasMore"
        class="text-center text-sm text-muted-foreground"
      >
        Все {{ total }} товаров
      </p>

      <div
        ref="sentinel"
        class="h-1 w-full"
        aria-hidden="true"
      />
    </template>

    <div
      v-else
      class="flex min-h-[22rem] flex-col items-start justify-center gap-4 rounded-lg border border-border p-6"
    >
      <p class="text-lg font-medium">
        Ничего не найдено
      </p>
      <p
        v-if="search"
        class="text-sm text-muted-foreground"
      >
        По запросу «{{ search }}» нет совпадений.
      </p>
      <Button
        type="button"
        @click="resetFilters()"
      >
        Сбросить фильтры
      </Button>
    </div>
  </div>
</template>
