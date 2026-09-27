import type { Product } from '#shared/types/product'

export const openCartInjectionKey: InjectionKey<() => void> = Symbol('openCart')

/** Layout-level navigation tools available on every page. */
export function useStorefrontWebMcpTools(options: {
  openCart: () => void
}): void {
  const router = useRouter()

  useWebMcpTool({
    name: 'openCart',
    description:
      'Open the shopping cart sheet so the user can review items, change quantities, or proceed to checkout.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: {
      readOnlyHint: false,
      consequentialHint: false,
    },
    execute: async () => {
      options.openCart()
      return 'Cart sheet opened.'
    },
  })

  useWebMcpTool({
    name: 'goToCheckout',
    description:
      'Navigate to the checkout page to enter delivery details and place an order for items in the cart.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: {
      readOnlyHint: false,
      consequentialHint: true,
    },
    execute: async () => {
      await router.push('/checkout')
      return 'Navigated to checkout.'
    },
  })
}

/** PDP tool: add the current (or specified) product to the cart. */
export function useProductWebMcpTools(options: {
  product: MaybeRefOrGetter<Product | null | undefined>
  quantity: MaybeRefOrGetter<number>
}): void {
  const cart = useCartStore()

  useWebMcpTool(() => {
    const product = toValue(options.product)
    if (!product) {
      return null
    }

    const defaultQuantity = Math.max(1, Math.trunc(toValue(options.quantity) || 1))

    return {
      name: 'addToCart',
      description:
        `Add "${product.title}" (id ${product.id}) to the shopping cart. `
        + 'Use quantity to set how many units to add, limited by stock.',
      inputSchema: {
        type: 'object',
        properties: {
          productId: {
            type: 'integer',
            description: `Product id. Defaults to the current product (${product.id}).`,
            default: product.id,
          },
          quantity: {
            type: 'integer',
            description: 'Number of units to add.',
            minimum: 1,
            maximum: product.stock,
            default: defaultQuantity,
          },
        },
      },
      annotations: {
        readOnlyHint: false,
        consequentialHint: false,
      },
      execute: async (input: Record<string, unknown>) => {
        const requestedId = typeof input.productId === 'number'
          ? input.productId
          : product.id
        const qtyRaw = typeof input.quantity === 'number'
          ? input.quantity
          : defaultQuantity
        const qty = Math.max(1, Math.trunc(qtyRaw))

        let target = product
        if (requestedId !== product.id) {
          target = await $fetch<Product>(`/api/products/${requestedId}`)
        }

        if (target.stock < 1) {
          return {
            ok: false,
            error: `Product ${target.title} is out of stock.`,
          }
        }

        cart.addItem(target, qty)
        return {
          ok: true,
          productId: target.id,
          title: target.title,
          quantityAdded: qty,
          cartItems: cart.totalItems,
        }
      },
    } satisfies WebMcpToolDefinition
  })
}
