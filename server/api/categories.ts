import type { Category } from '#shared/types/product'
import {
  DUMMYJSON_BASE_URL,
  handleDummyJsonError,
} from '../utils/dummyjson'

export default defineCachedEventHandler(
  async (): Promise<Category[]> => {
    try {
      return await $fetch<Category[]>(
        `${DUMMYJSON_BASE_URL}/products/categories`,
      )
    }
    catch (error: unknown) {
      handleDummyJsonError(error)
    }
  },
  {
    maxAge: 60 * 60,
    swr: true,
  },
)
