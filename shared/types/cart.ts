import type { Product } from './product'

/** Fields required to add a line to the cart (full Product is not needed). */
export type CartProductInput = Pick<
  Product,
  'id' | 'title' | 'price' | 'discountPercentage' | 'thumbnail' | 'stock'
>

export interface CartItem {
  id: number
  title: string
  price: number
  discountPercentage: number
  quantity: number
  thumbnail: string
  stock: number
}

export interface Cart {
  items: CartItem[]
}

export interface CartTotals {
  totalQuantity: number
  totalPrice: number
}
