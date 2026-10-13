import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import { FetchError } from 'ofetch'
import { z } from 'zod'
import type {
  AssistantCartItem,
  AssistantEvent,
  AssistantProductCard,
} from '#shared/types/assistant'
import type { Category, Product } from '#shared/types/product'
import {
  ASSISTANT_CART_MAX_QUANTITY,
  ASSISTANT_CART_MIN_QUANTITY,
  ASSISTANT_DESCRIPTION_LIMIT,
  ASSISTANT_SEARCH_FETCH_LIMIT,
  ASSISTANT_SEARCH_RESULT_LIMIT,
} from './assistant-config'
import { DUMMYJSON_BASE_URL, fetchDummyJsonProducts } from './dummyjson'

const CATEGORY_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const optionalNumber = z.union([
  z.number().finite(),
  z.string().trim().regex(/^\d+(\.\d+)?$/).transform(Number),
]).optional()

const optionalInteger = z.union([
  z.number().int(),
  z.string().trim().regex(/^-?\d+$/).transform(Number),
]).optional()

const productIdSchema = z.union([
  z.number().int().positive(),
  z.string().trim().regex(/^[1-9]\d*$/).transform(Number),
])

const searchArgsSchema = z.object({
  query: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().toLowerCase().min(1).max(80).optional(),
  max_price: optionalNumber,
  sort: z.enum(['price_asc', 'rating_desc']).optional(),
})

const productArgsSchema = z.object({
  id: productIdSchema,
})

const cartArgsSchema = z.object({
  id: productIdSchema,
  quantity: optionalInteger,
})

export interface AssistantToolResult {
  forModel: unknown
  events: AssistantEvent[]
}

export const ASSISTANT_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: 'Search the Atelier catalog before recommending anything. query must be English. category is a DummyJSON slug. max_price keeps items whose discounted USD price is at or below the value. sort orders matches before the list is cut to 5.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          query: {
            type: 'string',
            description: 'English catalog search text',
          },
          category: {
            type: 'string',
            description: 'Category slug such as beauty or furniture',
          },
          max_price: {
            type: 'number',
            description: 'Maximum discounted price in USD',
          },
          sort: {
            type: 'string',
            enum: ['price_asc', 'rating_desc'],
            description: 'price_asc sorts by discounted price, rating_desc by rating',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_product',
      description: 'Load one product. Shipping, warranty, and return text come only from this tool. Do not invent them.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['id'],
        properties: {
          id: {
            type: 'integer',
            description: 'Product id',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_to_cart',
      description: 'Ask the storefront to add a product to the cart. Call only after the user explicitly asks to add it. Quantity is an integer from 1 to 5.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['id'],
        properties: {
          id: {
            type: 'integer',
            description: 'Product id',
          },
          quantity: {
            type: 'integer',
            description: 'How many to add, from 1 to 5. Defaults to 1.',
          },
        },
      },
    },
  },
]

const getAssistantCategorySlugs = defineCachedFunction(async (): Promise<string[]> => {
  const categories = await $fetch<Category[]>(`${DUMMYJSON_BASE_URL}/products/categories`)
  return categories.map(category => category.slug)
}, {
  maxAge: 60 * 60,
  name: 'assistantCategorySlugs',
  getKey: () => 'all',
})

function toolError(message: string): AssistantToolResult {
  return {
    forModel: { error: message },
    events: [],
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function discountedUnit(price: number, discountPercentage: number): number {
  return roundMoney(price * (1 - discountPercentage / 100))
}

function parseArguments(raw: string): unknown {
  const trimmed = raw.trim()
  if (trimmed === '') {
    return {}
  }
  try {
    return JSON.parse(trimmed) as unknown
  }
  catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function catalogFailure(error: unknown): string {
  if (error instanceof FetchError && error.statusCode === 404) {
    return 'Product not found'
  }
  return 'Catalog request failed'
}

function toCard(product: Product): AssistantProductCard {
  return {
    id: product.id,
    title: product.title,
    price: product.price,
    discountPercentage: product.discountPercentage,
    rating: product.rating,
    thumbnail: product.thumbnail,
    stock: product.stock,
  }
}

function toCartItem(product: Product): AssistantCartItem {
  return {
    id: product.id,
    title: product.title,
    price: product.price,
    discountPercentage: product.discountPercentage,
    thumbnail: product.thumbnail,
    stock: product.stock,
  }
}

function toModelProduct(product: Product) {
  return {
    id: product.id,
    title: product.title,
    price: discountedUnit(product.price, product.discountPercentage),
    listPrice: roundMoney(product.price),
    rating: product.rating,
    stock: product.stock,
    category: product.category,
  }
}

async function loadProduct(id: number): Promise<Product | undefined> {
  try {
    return await $fetch<Product>(`${DUMMYJSON_BASE_URL}/products/${id}`)
  }
  catch (error: unknown) {
    if (error instanceof FetchError && error.statusCode === 404) {
      return undefined
    }
    throw error
  }
}

async function searchProducts(args: Record<string, unknown>): Promise<AssistantToolResult> {
  const parsed = searchArgsSchema.safeParse(args)
  if (!parsed.success) {
    return toolError('Invalid arguments for search_products')
  }

  const { query, category, sort } = parsed.data
  const maxPrice = parsed.data.max_price
  if (maxPrice !== undefined && (maxPrice <= 0 || maxPrice > 1_000_000)) {
    return toolError('Invalid max_price')
  }
  if (query === undefined && category === undefined) {
    return toolError('Provide query or category')
  }
  if (category !== undefined && !CATEGORY_SLUG_RE.test(category)) {
    return toolError('Unknown category')
  }

  if (category !== undefined) {
    let slugs: string[]
    try {
      slugs = await getAssistantCategorySlugs()
    }
    catch {
      return toolError('Category list is unavailable')
    }
    if (!slugs.includes(category)) {
      return {
        forModel: { error: 'Unknown category', categories: slugs },
        events: [],
      }
    }
  }

  let products: Product[]
  try {
    const data = await fetchDummyJsonProducts({
      q: query,
      category,
      limit: ASSISTANT_SEARCH_FETCH_LIMIT,
      skip: 0,
    })
    products = data.products
  }
  catch {
    return toolError('Catalog request failed')
  }

  if (maxPrice !== undefined) {
    products = products.filter(product =>
      discountedUnit(product.price, product.discountPercentage) <= maxPrice,
    )
  }

  if (sort === 'price_asc') {
    products = [...products].sort((left, right) => {
      const diff = discountedUnit(left.price, left.discountPercentage)
        - discountedUnit(right.price, right.discountPercentage)
      return diff !== 0 ? diff : left.id - right.id
    })
  }
  else if (sort === 'rating_desc') {
    products = [...products].sort((left, right) => {
      const diff = right.rating - left.rating
      return diff !== 0 ? diff : left.id - right.id
    })
  }

  products = products.slice(0, ASSISTANT_SEARCH_RESULT_LIMIT)
  const cards = products.map(toCard)
  const events: AssistantEvent[] = cards.length > 0
    ? [{ type: 'products', items: cards }]
    : []

  return {
    forModel: { products: products.map(toModelProduct) },
    events,
  }
}

async function getProduct(args: Record<string, unknown>): Promise<AssistantToolResult> {
  const parsed = productArgsSchema.safeParse(args)
  if (!parsed.success) {
    return toolError('Invalid arguments for get_product')
  }

  let product: Product | undefined
  try {
    product = await loadProduct(parsed.data.id)
  }
  catch (error: unknown) {
    return toolError(catalogFailure(error))
  }
  if (product === undefined) {
    return toolError('Product not found')
  }

  return {
    forModel: {
      id: product.id,
      title: product.title,
      description: product.description.slice(0, ASSISTANT_DESCRIPTION_LIMIT),
      price: discountedUnit(product.price, product.discountPercentage),
      listPrice: roundMoney(product.price),
      stock: product.stock,
      availabilityStatus: product.availabilityStatus,
      shippingInformation: product.shippingInformation,
      warrantyInformation: product.warrantyInformation,
      returnPolicy: product.returnPolicy,
      category: product.category,
    },
    events: [],
  }
}

async function addToCart(args: Record<string, unknown>): Promise<AssistantToolResult> {
  const parsed = cartArgsSchema.safeParse(args)
  if (!parsed.success) {
    return toolError('Invalid arguments for add_to_cart')
  }

  const requested = parsed.data.quantity ?? ASSISTANT_CART_MIN_QUANTITY
  if (!Number.isInteger(requested) || requested < ASSISTANT_CART_MIN_QUANTITY) {
    return toolError('Quantity must be an integer from 1 to 5')
  }

  let quantity = requested
  let note: string | undefined
  if (quantity > ASSISTANT_CART_MAX_QUANTITY) {
    quantity = ASSISTANT_CART_MAX_QUANTITY
    note = 'Quantity was limited to 5'
  }

  let product: Product | undefined
  try {
    product = await loadProduct(parsed.data.id)
  }
  catch (error: unknown) {
    return toolError(catalogFailure(error))
  }
  if (product === undefined) {
    return toolError('Product not found')
  }
  if (product.stock < 1) {
    return {
      forModel: {
        error: 'Out of stock',
        id: product.id,
        title: product.title,
      },
      events: [],
    }
  }
  if (quantity > product.stock) {
    quantity = product.stock
    note = 'Quantity was limited to available stock'
  }

  const item = toCartItem(product)
  return {
    forModel: {
      ok: true,
      id: product.id,
      title: product.title,
      quantity,
      ...(note !== undefined ? { note } : {}),
    },
    events: [{ type: 'cart_add', item, quantity }],
  }
}

export async function runAssistantTool(
  name: string,
  rawArguments: string,
): Promise<AssistantToolResult> {
  const parsed = parseArguments(rawArguments)
  if (!isRecord(parsed)) {
    return toolError('Invalid tool arguments')
  }

  switch (name) {
    case 'search_products':
      return searchProducts(parsed)
    case 'get_product':
      return getProduct(parsed)
    case 'add_to_cart':
      return addToCart(parsed)
    default:
      return toolError('Unknown tool')
  }
}
