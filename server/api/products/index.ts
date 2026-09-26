import type { ProductsResponse } from '#shared/types/product'
import {
  fetchDummyJsonProducts,
  parseProductListQuery,
} from '../../utils/dummyjson'

export default defineCachedEventHandler(
  async (event): Promise<ProductsResponse> => {
    const params = parseProductListQuery(event)
    return fetchDummyJsonProducts(params)
  },
  {
    maxAge: 5 * 60,
    swr: true,
    getKey: (event) => {
      const query = getQuery(event)
      return `products:${JSON.stringify(query)}`
    },
  },
)
