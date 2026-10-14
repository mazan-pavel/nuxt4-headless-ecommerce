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
            description: 'Exact DummyJSON slug only, e.g. mens-watches, womens-watches, beauty. Never invent watches or accessories.',
          },
          max_price: {
            type: 'number',
            description: 'Maximum discounted price in USD. Put the budget here, not in query.',
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

/** Everyday words models invent → real DummyJSON category slugs. */
const CATEGORY_ALIASES: Record<string, readonly string[]> = {
  watches: ['mens-watches', 'womens-watches'],
  watch: ['mens-watches', 'womens-watches'],
  clocks: ['mens-watches', 'womens-watches'],
  clock: ['mens-watches', 'womens-watches'],
  bags: ['womens-bags'],
  bag: ['womens-bags'],
  handbags: ['womens-bags'],
  shoes: ['mens-shoes', 'womens-shoes'],
  shirts: ['mens-shirts', 'tops'],
  accessories: ['mobile-accessories', 'sports-accessories', 'kitchen-accessories'],
  iphones: ['smartphones'],
  iphone: ['smartphones'],
  phones: ['smartphones'],
  phone: ['smartphones'],
  smartphones: ['smartphones'],
  smartphone: ['smartphones'],
}

function normalizeSearchQuery(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined
  }
  let q = raw.trim()
  if (q === '') {
    return undefined
  }
  // Budget belongs in max_price; strip phrases like "under $50".
  q = q
    .replace(/\b(under|below|up to|less than|до)\s*\$?\s*\d+([.,]\d+)?\b/gi, ' ')
    .replace(/\$\s*\d+([.,]\d+)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (q === '') {
    return undefined
  }
  // DummyJSON search is weak on plurals: "watches" → 0, "watch" → hits.
  if (q.length > 3 && q.endsWith('s') && !q.endsWith('ss')) {
    return q.slice(0, -1)
  }
  return q
}

function suggestCategorySlugs(requested: string, slugs: readonly string[]): string[] {
  const aliases = CATEGORY_ALIASES[requested]
  if (aliases !== undefined) {
    return aliases.filter(slug => slugs.includes(slug))
  }
  const token = requested.replace(/-/g, '')
  return slugs
    .filter(slug => slug.includes(requested) || requested.includes(slug) || slug.replace(/-/g, '').includes(token))
    .slice(0, 5)
}

function mergeById(lists: Product[][]): Product[] {
  const byId = new Map<number, Product>()
  for (const list of lists) {
    for (const product of list) {
      byId.set(product.id, product)
    }
  }
  return [...byId.values()]
}

function sortProducts(
  products: Product[],
  sort: 'price_asc' | 'rating_desc' | undefined,
): Product[] {
  if (sort === 'price_asc') {
    return [...products].sort((left, right) => {
      const diff = discountedUnit(left.price, left.discountPercentage)
        - discountedUnit(right.price, right.discountPercentage)
      return diff !== 0 ? diff : left.id - right.id
    })
  }
  if (sort === 'rating_desc') {
    return [...products].sort((left, right) => {
      const diff = right.rating - left.rating
      return diff !== 0 ? diff : left.id - right.id
    })
  }
  return products
}

async function fetchProductsForSearch(
  query: string | undefined,
  category: string | undefined,
): Promise<Product[]> {
  const data = await fetchDummyJsonProducts({
    q: query,
    category,
    limit: ASSISTANT_SEARCH_FETCH_LIMIT,
    skip: 0,
  })
  return data.products
}

async function loadProductsRobust(
  query: string | undefined,
  categories: readonly string[] | undefined,
): Promise<Product[]> {
  try {
    if (categories !== undefined && categories.length > 0) {
      const lists = await Promise.all(
        categories.map(async (category) => {
          // Prefer category listing: DummyJSON search("watches") returns 0 hits.
          let products = await fetchProductsForSearch(undefined, category)
          if (products.length === 0 && query !== undefined) {
            products = await fetchProductsForSearch(query, category)
          }
          return products
        }),
      )
      const merged = mergeById(lists)
      if (merged.length > 0) {
        return merged
      }
    }

    if (query !== undefined) {
      return await fetchProductsForSearch(query, undefined)
    }

    if (categories !== undefined && categories.length === 1) {
      return await fetchProductsForSearch(undefined, categories[0])
    }
    return []
  }
  catch {
    throw new Error('Catalog request failed')
  }
}

async function searchProducts(args: Record<string, unknown>): Promise<AssistantToolResult> {
  const parsed = searchArgsSchema.safeParse(args)
  if (!parsed.success) {
    return toolError('Invalid arguments for search_products')
  }

  const sort = parsed.data.sort
  const maxPrice = parsed.data.max_price
  const query = normalizeSearchQuery(parsed.data.query)
  const categoryRaw = parsed.data.category

  if (maxPrice !== undefined && (maxPrice <= 0 || maxPrice > 1_000_000)) {
    return toolError('Invalid max_price')
  }
  if (query === undefined && categoryRaw === undefined) {
    return toolError('Provide query or category')
  }
  if (categoryRaw !== undefined && !CATEGORY_SLUG_RE.test(categoryRaw)) {
    return toolError('Unknown category')
  }

  let slugs: string[] = []
  try {
    slugs = await getAssistantCategorySlugs()
  }
  catch {
    return toolError('Category list is unavailable')
  }

  let categories: string[] | undefined
  if (categoryRaw !== undefined) {
    if (slugs.includes(categoryRaw)) {
      categories = [categoryRaw]
    }
    else {
      const suggestions = suggestCategorySlugs(categoryRaw, slugs)
      if (suggestions.length > 0) {
        categories = suggestions
      }
      else if (query !== undefined) {
        // Invented slug (e.g. mens-bikes): ignore category, search by query only.
        categories = undefined
      }
      else {
        return {
          forModel: {
            error: 'Unknown category',
            hint: 'Retry with query only (English), without category.',
            suggestions: slugs.slice(0, 8),
          },
          events: [],
        }
      }
    }
  }

  let products: Product[]
  try {
    products = await loadProductsRobust(query, categories)
  }
  catch {
    return toolError('Catalog request failed')
  }

  // DummyJSON "bike" hits motorcycles — keep true bicycle intent empty.
  const bicycleIntent = query !== undefined && /^(bicycles?|bike|велосипед)/i.test(query)
  if (bicycleIntent) {
    products = products.filter((product) => {
      const hay = `${product.title} ${product.category}`.toLowerCase()
      return !hay.includes('motorcycle') && !hay.includes('scooter')
    })
  }

  let nearestProducts: Product[] | undefined
  if (maxPrice !== undefined) {
    const within = products.filter(product =>
      discountedUnit(product.price, product.discountPercentage) <= maxPrice,
    )
    if (within.length === 0 && products.length > 0 && !bicycleIntent) {
      nearestProducts = sortProducts(products, 'price_asc').slice(0, 3)
    }
    products = within
  }
  if (bicycleIntent && products.length === 0) {
    return {
      forModel: {
        products: [],
        note: 'No bicycles in the Atelier catalog. Motorcycle category is unrelated — do not offer it as a bicycle substitute unless the user asks for motorcycles.',
      },
      events: [],
    }
  }

  products = sortProducts(products, sort).slice(0, ASSISTANT_SEARCH_RESULT_LIMIT)
  const cards = products.map(toCard)
  const nearestCards = nearestProducts?.map(toCard) ?? []
  const events: AssistantEvent[] = cards.length > 0
    ? [{ type: 'products', items: cards }]
    : nearestCards.length > 0
      ? [{ type: 'products', items: nearestCards }]
      : []

  return {
    forModel: {
      products: products.map(toModelProduct),
      ...(nearestProducts !== undefined
        ? {
            note: 'No items at or below max_price in this scope; nearestAboveBudget lists the cheapest alternatives.',
            nearestAboveBudget: nearestProducts.map(toModelProduct),
          }
        : {}),
    },
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
      rating: product.rating,
      stock: product.stock,
      availabilityStatus: product.availabilityStatus,
      shippingInformation: product.shippingInformation,
      warrantyInformation: product.warrantyInformation,
      returnPolicy: product.returnPolicy,
      category: product.category,
      note: 'DummyJSON has no review text — use rating and description only. Do not invent customer quotes.',
    },
    events: [{ type: 'products', items: [toCard(product)] }],
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
