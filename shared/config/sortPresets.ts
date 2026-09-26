import type { ProductSortField, SortOrder } from '#shared/types/filter'

export type SortPresetId =
  | 'default'
  | 'price-asc'
  | 'price-desc'
  | 'rating-desc'
  | 'title-asc'

export interface SortPreset {
  id: SortPresetId
  label: string
  sortBy?: ProductSortField
  order?: SortOrder
}

export const SORT_PRESETS: readonly SortPreset[] = [
  { id: 'default', label: 'По умолчанию' },
  { id: 'price-asc', label: 'Сначала дешевле', sortBy: 'price', order: 'asc' },
  { id: 'price-desc', label: 'Сначала дороже', sortBy: 'price', order: 'desc' },
  { id: 'rating-desc', label: 'По рейтингу', sortBy: 'rating', order: 'desc' },
  { id: 'title-asc', label: 'По названию', sortBy: 'title', order: 'asc' },
] as const

export function sortPresetFromQuery(
  sortBy: ProductSortField | undefined,
  order: SortOrder | undefined,
): SortPresetId {
  if (sortBy === undefined && order === undefined) {
    return 'default'
  }
  const match = SORT_PRESETS.find(
    preset => preset.sortBy === sortBy && preset.order === order,
  )
  return match?.id ?? 'default'
}

export function sortPresetById(id: string): SortPreset | undefined {
  return SORT_PRESETS.find(preset => preset.id === id)
}
