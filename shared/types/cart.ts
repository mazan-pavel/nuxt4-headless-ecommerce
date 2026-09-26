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
