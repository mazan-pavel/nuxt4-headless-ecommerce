import { useStorage } from '@vueuse/core'
import { skipHydrate } from 'pinia'
import type { CartItem } from '#shared/types/cart'
import type { Product } from '#shared/types/product'

function unitDiscountedPrice(price: number, discountPercentage: number): number {
  return price * (1 - discountPercentage / 100)
}

export const useCartStore = defineStore('cart', () => {
  const items = useStorage<CartItem[]>('cart-items', [], undefined, {
    initOnMounted: true,
    writeDefaults: false,
  })

  const lastAnnouncement = ref('')

  const totalItems = computed(() =>
    items.value.reduce((sum, item) => sum + item.quantity, 0),
  )

  const totalPrice = computed(() =>
    items.value.reduce((sum, item) => sum + item.price * item.quantity, 0),
  )

  const discountedTotal = computed(() =>
    items.value.reduce(
      (sum, item) =>
        sum + unitDiscountedPrice(item.price, item.discountPercentage) * item.quantity,
      0,
    ),
  )

  function addItem(product: Product, quantity = 1): void {
    const add = Math.max(1, Math.trunc(quantity))
    const existing = items.value.find(item => item.id === product.id)

    if (existing) {
      const nextQuantity = Math.min(existing.stock, existing.quantity + add)
      if (nextQuantity < 1) {
        lastAnnouncement.value = `Товар ${product.title} нет в наличии`
        return
      }
      items.value = items.value.map(item =>
        item.id === product.id
          ? {
              ...item,
              title: product.title,
              price: product.price,
              discountPercentage: product.discountPercentage,
              thumbnail: product.thumbnail,
              stock: product.stock,
              quantity: nextQuantity,
            }
          : item,
      )
    }
    else if (product.stock < 1) {
      lastAnnouncement.value = `Товар ${product.title} нет в наличии`
      return
    }
    else {
      items.value = [
        ...items.value,
        {
          id: product.id,
          title: product.title,
          price: product.price,
          discountPercentage: product.discountPercentage,
          quantity: Math.min(product.stock, add),
          thumbnail: product.thumbnail,
          stock: product.stock,
        },
      ]
    }

    lastAnnouncement.value = `Товар ${product.title} добавлен в корзину`
  }

  function removeItem(productId: number): void {
    const existing = items.value.find(item => item.id === productId)
    if (!existing) {
      return
    }

    items.value = items.value.filter(item => item.id !== productId)
    lastAnnouncement.value = `Товар ${existing.title} удалён из корзины`
  }

  function updateQuantity(productId: number, quantity: number): void {
    const existing = items.value.find(item => item.id === productId)
    if (!existing) {
      return
    }

    if (quantity < 1 || existing.stock < 1) {
      removeItem(productId)
      return
    }

    const nextQuantity = Math.min(existing.stock, Math.max(1, Math.trunc(quantity)))
    items.value = items.value.map(item =>
      item.id === productId
        ? { ...item, quantity: nextQuantity }
        : item,
    )
    lastAnnouncement.value = `Количество товара ${existing.title}: ${nextQuantity}`
  }

  function clearCart(): void {
    items.value = []
    lastAnnouncement.value = 'Корзина очищена'
  }

  return {
    items: skipHydrate(items),
    lastAnnouncement,
    totalItems,
    totalPrice,
    discountedTotal,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
  }
})
