import type { ProductsResponse } from '#shared/types/product'
import {
  fetchDummyJsonProducts,
  parseProductListQuery,
} from '../../utils/dummyjson'

export default defineEventHandler(async (event): Promise<ProductsResponse> => {
  const params = parseProductListQuery(event)
  return fetchDummyJsonProducts(params)
})
