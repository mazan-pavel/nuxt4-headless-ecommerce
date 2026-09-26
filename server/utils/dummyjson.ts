import type { H3Event } from 'h3'
import { FetchError } from 'ofetch'
import type {
  ProductListQuery,
  ProductSortField,
  SortOrder,
} from '#shared/types/filter'
import type { ProductsResponse } from '#shared/types/product'

export const DUMMYJSON_BASE_URL = 'https://dummyjson.com'

const SORT_FIELDS: readonly ProductSortField[] = ['title', 'price', 'rating']
const SORT_ORDERS: readonly SortOrder[] = ['asc', 'desc']
const CATEGORY_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function asOptionalString(value: unknown): string | undefined {
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

export function handleDummyJsonError(error: unknown): never {
  if (error instanceof FetchError && error.statusCode === 404) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
  throw createError({ statusCode: 502, statusMessage: 'Bad Gateway' })
}

export function parseProductListQuery(event: H3Event): ProductListQuery {
  const query = getQuery(event)

  const limitRaw = asOptionalString(query.limit)
  let limit = 30
  if (limitRaw !== undefined && limitRaw !== '') {
    const parsed = Number(limitRaw)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid limit' })
    }
    limit = parsed
  }

  const skipRaw = asOptionalString(query.skip)
  let skip = 0
  if (skipRaw !== undefined && skipRaw !== '') {
    const parsed = Number(skipRaw)
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid skip' })
    }
    skip = parsed
  }

  const sortByRaw = asOptionalString(query.sortBy)
  let sortBy: ProductSortField | undefined
  if (sortByRaw !== undefined && sortByRaw !== '') {
    if (!isProductSortField(sortByRaw)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid sortBy' })
    }
    sortBy = sortByRaw
  }

  const orderRaw = asOptionalString(query.order)
  let order: SortOrder | undefined
  if (orderRaw !== undefined && orderRaw !== '') {
    if (!isSortOrder(orderRaw)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid order' })
    }
    order = orderRaw
  }

  const categoryRaw = asOptionalString(query.category)
  let category: string | undefined
  if (categoryRaw !== undefined && categoryRaw !== '') {
    if (!CATEGORY_SLUG_RE.test(categoryRaw)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid category' })
    }
    category = categoryRaw
  }

  const qRaw = asOptionalString(query.q)
  const qTrimmed = qRaw?.trim()
  const q = qTrimmed !== undefined && qTrimmed !== '' ? qTrimmed : undefined

  return { q, category, sortBy, order, limit, skip }
}

function buildUpstreamQuery(
  params: ProductListQuery,
): Record<string, string | number> {
  const query: Record<string, string | number> = {
    limit: params.limit,
    skip: params.skip,
  }
  if (params.sortBy !== undefined) {
    query.sortBy = params.sortBy
  }
  if (params.order !== undefined) {
    query.order = params.order
  }
  if (params.q !== undefined) {
    query.q = params.q
  }
  return query
}

export async function fetchDummyJsonProducts(
  params: ProductListQuery,
): Promise<ProductsResponse> {
  const upstreamQuery = buildUpstreamQuery(params)
  const q = params.q
  const category = params.category

  try {
    if (q !== undefined && category !== undefined) {
      const data = await $fetch<ProductsResponse>(
        `${DUMMYJSON_BASE_URL}/products/search`,
        { query: upstreamQuery },
      )
      return {
        ...data,
        products: data.products.filter(
          (product) => product.category === category,
        ),
      }
    }

    if (q !== undefined) {
      return await $fetch<ProductsResponse>(
        `${DUMMYJSON_BASE_URL}/products/search`,
        { query: upstreamQuery },
      )
    }

    if (category !== undefined) {
      const slug = encodeURIComponent(category)
      return await $fetch<ProductsResponse>(
        `${DUMMYJSON_BASE_URL}/products/category/${slug}`,
        { query: upstreamQuery },
      )
    }

    return await $fetch<ProductsResponse>(`${DUMMYJSON_BASE_URL}/products`, {
      query: upstreamQuery,
    })
  }
  catch (error: unknown) {
    handleDummyJsonError(error)
  }
}
