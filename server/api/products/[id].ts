import type { Product } from '#shared/types/product'
import {
  DUMMYJSON_BASE_URL,
  handleDummyJsonError,
} from '../../utils/dummyjson'

const PRODUCT_ID_RE = /^[1-9]\d*$/

const cachedProductHandler = defineCachedEventHandler(
  async (event): Promise<Product> => {
    const id = getRouterParam(event, 'id')
    try {
      return await $fetch<Product>(`${DUMMYJSON_BASE_URL}/products/${id}`)
    }
    catch (error: unknown) {
      handleDummyJsonError(error)
    }
  },
  {
    maxAge: 15 * 60,
    swr: true,
    getKey: (event) => {
      const id = getRouterParam(event, 'id')
      return `product:${id ?? ''}`
    },
  },
)

export default defineEventHandler(async (event): Promise<Product> => {
  const id = getRouterParam(event, 'id')
  if (id === undefined || !PRODUCT_ID_RE.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid product id' })
  }
  return cachedProductHandler(event)
})
