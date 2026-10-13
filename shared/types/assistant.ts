export interface AssistantShownProduct {
  id: number
  title: string
}

export interface AssistantClientMessage {
  role: 'user' | 'assistant'
  content: string
  shown?: AssistantShownProduct[]
}

export interface AssistantProductCard {
  id: number
  title: string
  price: number
  discountPercentage: number
  rating: number
  thumbnail: string
  stock: number
}

export interface AssistantCartItem {
  id: number
  title: string
  price: number
  discountPercentage: number
  thumbnail: string
  stock: number
}

export type AssistantEvent =
  | { type: 'text', delta: string }
  | { type: 'products', items: AssistantProductCard[] }
  | { type: 'cart_add', item: AssistantCartItem, quantity: number }
  | { type: 'error', message: string }

export interface AssistantRequest {
  messages: AssistantClientMessage[]
}
