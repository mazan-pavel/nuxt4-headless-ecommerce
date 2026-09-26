import type { LocationQueryRaw } from 'vue-router'
import type {
  ProductListQuery,
  ProductSortField,
  SortOrder,
} from '#shared/types/filter'

const SORT_FIELDS: readonly ProductSortField[] = ['title', 'price', 'rating']
const SORT_ORDERS: readonly SortOrder[] = ['asc', 'desc']
const FILTER_KEYS = ['category', 'search', 'sortBy', 'order', 'page', 'limit'] as const

const DEFAULT_LIMIT = 30

function readQueryValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0]
  }
  return undefined
}

function isProductSortField(value: string): value is ProductSortField {
  return (SORT_FIELDS as readonly string[]).includes(value)
}

function isSortOrder(value: string): value is SortOrder {
  return (SORT_ORDERS as readonly string[]).includes(value)
}

export function useCatalogFilter() {
  const route = useRoute()
  const router = useRouter()

  function read(key: string): string | undefined {
    return readQueryValue(route.query[key])
  }

  function replaceQuery(
    patch: Record<string, string | undefined>,
    resetPage: boolean,
  ) {
    const next: LocationQueryRaw = { ...route.query }

    for (const [key, value] of Object.entries(patch)) {
      next[key] = value === undefined || value === '' ? undefined : value
    }

    if (resetPage) {
      next.page = undefined
    }

    return router.replace({ query: next })
  }

  const category = computed({
    get(): string {
      return read('category') ?? ''
    },
    set(value: string) {
      const next = value.trim()
      void replaceQuery({ category: next === '' ? undefined : next }, true)
    },
  })

  const search = computed({
    get(): string {
      return read('search') ?? ''
    },
    set(value: string) {
      const next = value.trim()
      void replaceQuery({ search: next === '' ? undefined : next }, true)
    },
  })

  const sortBy = computed({
    get(): ProductSortField | undefined {
      const raw = read('sortBy')
      if (raw !== undefined && isProductSortField(raw)) {
        return raw
      }
      return undefined
    },
    set(value: ProductSortField | undefined) {
      void replaceQuery({ sortBy: value }, true)
    },
  })

  const order = computed({
    get(): SortOrder | undefined {
      const raw = read('order')
      if (raw !== undefined && isSortOrder(raw)) {
        return raw
      }
      return undefined
    },
    set(value: SortOrder | undefined) {
      void replaceQuery({ order: value }, true)
    },
  })

  const page = computed({
    get(): number {
      const raw = read('page')
      if (raw === undefined || raw === '') {
        return 1
      }
      const parsed = Number(raw)
      if (!Number.isInteger(parsed) || parsed < 1) {
        return 1
      }
      return parsed
    },
    set(value: number) {
      const next = Number.isInteger(value) && value > 1 ? String(value) : undefined
      void replaceQuery({ page: next }, false)
    },
  })

  const limit = computed({
    get(): number {
      const raw = read('limit')
      if (raw === undefined || raw === '') {
        return DEFAULT_LIMIT
      }
      const parsed = Number(raw)
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
        return DEFAULT_LIMIT
      }
      return parsed
    },
    set(value: number) {
      const parsed = Math.trunc(value)
      const next = parsed >= 1 && parsed <= 100 && parsed !== DEFAULT_LIMIT
        ? String(parsed)
        : undefined
      void replaceQuery({ limit: next }, false)
    },
  })

  const queryParams = computed((): ProductListQuery => {
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

  function resetFilters() {
    const next: LocationQueryRaw = { ...route.query }
    for (const key of FILTER_KEYS) {
      next[key] = undefined
    }
    return router.replace({ query: next })
  }

  return {
    category,
    search,
    sortBy,
    order,
    page,
    limit,
    queryParams,
    resetFilters,
  }
}
