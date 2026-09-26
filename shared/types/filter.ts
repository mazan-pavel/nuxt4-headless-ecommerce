export type ProductSortField = 'title' | 'price' | 'rating'

export type SortOrder = 'asc' | 'desc'

export interface ProductListQuery {
  q?: string
  category?: string
  sortBy?: ProductSortField
  order?: SortOrder
  limit: number
  skip: number
}
