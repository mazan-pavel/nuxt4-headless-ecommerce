import type {
  AssistantClientMessage,
  AssistantEvent,
  AssistantRequest,
  AssistantShownProduct,
} from '#shared/types/assistant'
import { runAssistantTool } from './assistant-tools'

const CART_INTENT_RE = /добав|в\s*корзин|add\s+to\s+cart|add\s+it|put\s+in\s+cart/i
const BARE_ADD_RE = /^(добавь|добавить|add)(\s+в\s+корзину)?[!?.]*$/i
const AFFIRM_RE = /^(да|yes|ок|ok|хорошо|уве|ладно|давай)[!?.]*$/i
const CHEAPEST_RE = /не\s*дорог|дешевл?е|самы[ех]\s+дешев|cheapest|lowest\s+price|подешев/i
const CART_SUCCESS_RE = /добавлен[аоы]?\s+в\s+(вашу\s+)?корзин|успешно\s+добавлен|added\s+to\s+(your\s+)?cart|в\s+корзину[^.]*готов/i
const PRODUCT_CLAIM_RE = /(\$\s*\d|\d+[.,]\d+\s*\$|доллар|\d+\.\d{2})/i
const BICYCLE_RE = /\b(bicycle|bicycles|велосипед\w*|velosiped)\b/i
// Require a budget cue — bare "1" is an ordinal, not $1.
const BUDGET_ONLY_RE = /^(?:(?:за|до|under|below)\s*\$?\s*\d+([.,]\d+)?|\$\s*\d+([.,]\d+)?)(?:\s*(?:отдашь|можно|есть))?\s*[?!.]*$/i
const ORDINAL_ONLY_RE = /^(?:вариант\s*)?(\d+|перв\w*|втор\w*|трет\w*|first|second|third)$/i
const DETAILS_INTENT_RE = /расскаж|подробн|о\s+них|о\s+нём|о\s+нем|about\s+(them|it)|что\s+за/i

export function lastUserText(request: AssistantRequest): string {
  for (let i = request.messages.length - 1; i >= 0; i -= 1) {
    const message = request.messages[i]
    if (message?.role === 'user') {
      return message.content
    }
  }
  return ''
}

function lastAssistantMessage(request: AssistantRequest): AssistantClientMessage | undefined {
  for (let i = request.messages.length - 1; i >= 0; i -= 1) {
    const message = request.messages[i]
    if (message?.role === 'assistant') {
      return message
    }
  }
  return undefined
}

function mostRecentShown(request: AssistantRequest): AssistantShownProduct[] {
  for (let i = request.messages.length - 1; i >= 0; i -= 1) {
    const message = request.messages[i]
    if (message?.role === 'assistant' && message.shown !== undefined && message.shown.length > 0) {
      return message.shown
    }
  }
  return []
}

function lastAssistantOfferedCart(request: AssistantRequest): boolean {
  const last = lastAssistantMessage(request)
  return last !== undefined && /добав\w*\s+(их|его|её|этот|эту|в\s+корзин)|в\s+корзину|add\s+(it|them|to\s+cart)|корзину\?/i.test(last.content)
}

function lastAssistantOfferedDetails(request: AssistantRequest): boolean {
  const last = lastAssistantMessage(request)
  return last !== undefined && /отзыв|рейтинг|подробн|посмотреть|посмотрим|увидеть|review/i.test(last.content)
}

/** Prefer the product the last assistant was already talking about (id / title). */
function focusFromLastAssistant(
  request: AssistantRequest,
  shown: readonly AssistantShownProduct[],
): AssistantShownProduct | undefined {
  const last = lastAssistantMessage(request)
  if (last === undefined || shown.length === 0) {
    return undefined
  }
  const idMatch = last.content.match(/\bid\s*[#:]?\s*(\d{1,5})\b/i)
  if (idMatch !== null) {
    const id = Number(idMatch[1])
    const byId = shown.find(item => item.id === id)
    if (byId !== undefined) {
      return byId
    }
  }
  return matchShownProduct(last.content, shown)
}

async function emitProductDetails(
  id: number,
  emit: (payload: AssistantEvent) => void,
): Promise<boolean> {
  const result = await runAssistantTool('get_product', JSON.stringify({ id }))
  for (const event of result.events) {
    emit(event)
  }
  const fm = result.forModel
  const rec = typeof fm === 'object' && fm !== null ? fm as Record<string, unknown> : undefined
  if (typeof rec?.title !== 'string') {
    emit({ type: 'text', delta: 'Не удалось загрузить детали товара. Уточните название.' })
    return false
  }
  const rating = typeof rec.rating === 'number' ? ` Рейтинг: ${rec.rating}.` : ''
  const desc = typeof rec.description === 'string' ? ` ${rec.description}` : ''
  const ship = typeof rec.shippingInformation === 'string' ? ` Доставка: ${rec.shippingInformation}.` : ''
  emit({
    type: 'text',
    delta: `${rec.title} — $${rec.price}.${rating}${desc}${ship} Добавить в корзину?`,
  })
  return true
}

/**
 * Prefer shown on the last assistant turn. If that turn is text-only but continues
 * a product discussion (cart/details offer), reuse the most recent cards.
 */
export function latestShown(request: AssistantRequest): AssistantShownProduct[] {
  const last = lastAssistantMessage(request)
  if (last?.shown !== undefined && last.shown.length > 0) {
    return last.shown
  }
  if (last !== undefined && (lastAssistantOfferedCart(request) || lastAssistantOfferedDetails(request))) {
    return mostRecentShown(request)
  }
  return []
}

export function isCartIntent(text: string): boolean {
  return CART_INTENT_RE.test(text) || isBareCartAdd(text)
}

export function isBareCartAdd(text: string): boolean {
  return BARE_ADD_RE.test(text.trim())
}

export function isAffirmation(text: string): boolean {
  return AFFIRM_RE.test(text.trim())
}

export function asksCheapest(text: string): boolean {
  return CHEAPEST_RE.test(text)
}

export function claimsCartSuccess(text: string): boolean {
  return CART_SUCCESS_RE.test(text)
}

export function isBicycleIntent(text: string): boolean {
  if (BICYCLE_RE.test(text)) {
    return true
  }
  const trimmed = text.trim()
  if (/^(bikes?)$/i.test(trimmed)) {
    return true
  }
  // "просто bike не мотоцикл"
  if (/\bbikes?\b/i.test(text) && /не\s+мото|not\s+(a\s+)?motor/i.test(text)) {
    return true
  }
  return false
}

/** Block only clear invented recommendations, not honest "nothing under budget" replies. */
export function looksLikeInventedCatalogClaim(text: string): boolean {
  if (/к сожалению|нет\s+(в\s+)?(каталог|базе|наличи|пустоват)|не\s+(нашёл|нашел|имеется|сто)|ближайш|no\s+(bicycles?|items?|products?)/i.test(text)) {
    return false
  }
  if (!PRODUCT_CLAIM_RE.test(text)) {
    return false
  }
  // Invented brand SKUs / "found N options" without a tool round.
  return /(bolon|iphone\s+\d|в\s+наличии\s+\d+|нашёл\s+несколько|нашел\s+несколько)/i.test(text)
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, ' ').replace(/\s+/g, ' ').trim()
}

/** Match an explicit product mention against last shown cards. */
export function matchShownProduct(
  userText: string,
  shown: readonly AssistantShownProduct[],
): AssistantShownProduct | undefined {
  if (shown.length === 0) {
    return undefined
  }
  const normalizedUser = normalizeName(userText)
  const userTokens = normalizedUser.split(' ').filter(token => token.length > 0)
  for (const item of shown) {
    const title = normalizeName(item.title)
    if (title.length >= 4 && normalizedUser.includes(title)) {
      return item
    }
    // Multi-word user query: every token must appear in the title ("iphone x" ≠ "… with iPhone").
    if (userTokens.length > 1) {
      if (userTokens.every(token => title.includes(token))) {
        return item
      }
      continue
    }
    const tokens = title.split(' ').filter(token => token.length > 3)
    const hitCount = tokens.filter(token => normalizedUser.includes(token)).length
    if (tokens.length > 0 && hitCount >= Math.min(2, tokens.length)) {
      return item
    }
    // Short single token: "Brown" → Brown Leather Belt Watch
    if (normalizedUser.length >= 4 && tokens.some(token => token.startsWith(normalizedUser) || normalizedUser.startsWith(token))) {
      return item
    }
  }
  const ordinal = normalizedUser.match(/\b(перв|1|first)\b/)
  if (ordinal !== null) {
    return shown[0]
  }
  const second = normalizedUser.match(/\b(втор|2|second)\b/)
  if (second !== null && shown.length > 1) {
    return shown[1]
  }
  const third = normalizedUser.match(/\b(трет|3|third)\b/)
  if (third !== null && shown.length > 2) {
    return shown[2]
  }
  return undefined
}

function listShown(shown: readonly AssistantShownProduct[]): string {
  return shown.map((item, index) => `${index + 1}) ${item.title}`).join('; ')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function inferSearchScopeFromShown(
  shown: readonly AssistantShownProduct[],
): { query: string; category?: string } {
  const blob = shown.map(item => item.title).join(' ').toLowerCase()
  if (/watch/.test(blob)) {
    return { query: 'watch', category: 'mens-watches' }
  }
  if (/bag/.test(blob)) {
    return { query: 'bag', category: 'womens-bags' }
  }
  if (/iphone|phone|charger|case/.test(blob)) {
    return { query: 'iphone' }
  }
  if (/shoe/.test(blob)) {
    return { query: 'shoe' }
  }
  const token = shown[0]?.title.split(/\s+/).find(part => part.length > 3)
  return { query: token ?? 'product' }
}

/** Pull a likely product title from the last assistant offer (before hallucinated cart). */
function extractOfferedProductQuery(assistantText: string): string | undefined {
  const patterns = [
    /(?:вариант|модель|товар|смартфон|часы)?\s*[-—:]?\s*((?:Apple\s+)?iPhone\s+[A-Za-z0-9]+(?:\s+\d+GB)?)/i,
    /((?:Brown Leather Belt Watch|Longines Master Collection|Rolex Cellini[^.\n,]{0,40}))/i,
    /(?:это|модель)\s+([A-Z][A-Za-z0-9]+(?:\s+[A-Za-z0-9/-]+){1,5})\s+(?:—|-|за|стоим)/,
  ]
  for (const pattern of patterns) {
    const match = assistantText.match(pattern)
    const title = match?.[1]?.trim()
    if (title !== undefined && title.length >= 4) {
      return title
    }
  }
  return undefined
}

async function emitCartFromId(
  id: number,
  emit: (payload: AssistantEvent) => void,
): Promise<boolean> {
  const result = await runAssistantTool(
    'add_to_cart',
    JSON.stringify({ id, quantity: 1 }),
  )
  for (const event of result.events) {
    emit(event)
  }
  const fm = result.forModel
  const rec = typeof fm === 'object' && fm !== null ? fm as Record<string, unknown> : undefined
  if (rec?.ok === true && typeof rec.title === 'string') {
    const qty = typeof rec.quantity === 'number' ? rec.quantity : 1
    emit({
      type: 'text',
      delta: `${rec.title} добавлен в корзину (${qty} шт.).`,
    })
    return true
  }
  const err = typeof rec?.error === 'string' ? rec.error : 'не удалось добавить'
  emit({
    type: 'text',
    delta: `Не добавил в корзину: ${err}. Выберите товар из показанных карточек.`,
  })
  return false
}

async function searchAndMaybeAdd(
  query: string,
  emit: (payload: AssistantEvent) => void,
  addFirst: boolean,
): Promise<boolean> {
  const result = await runAssistantTool(
    'search_products',
    JSON.stringify({ query, sort: 'price_asc' }),
  )
  for (const event of result.events) {
    emit(event)
  }
  const fm = result.forModel
  const rec = typeof fm === 'object' && fm !== null ? fm as Record<string, unknown> : undefined
  const products = Array.isArray(rec?.products) ? rec.products : []
  if (products.length === 0) {
    emit({
      type: 'text',
      delta: `В каталоге Atelier нет «${query}». Уточните название или категорию.`,
    })
    return true
  }
  const first = products[0]
  if (addFirst && products.length === 1 && isRecord(first) && typeof first.id === 'number') {
    return emitCartFromId(first.id, emit)
  }
  if (addFirst && products.length > 1) {
    emit({
      type: 'text',
      delta: `Нашёл несколько вариантов по запросу «${query}». Какой добавить? Напишите точное название или номер.`,
    })
    return true
  }
  return true
}

/**
 * Deterministic handling for cart / bicycle / cheapest so weak local models
 * cannot invent products or fake cart_add success.
 */
export async function tryGroundedTurn(
  request: AssistantRequest,
  emit: (payload: AssistantEvent) => void,
): Promise<boolean> {
  const userText = lastUserText(request)
  if (userText === '') {
    return false
  }
  const shown = latestShown(request)
  const lastAssistant = lastAssistantMessage(request)

  if (isBicycleIntent(userText)) {
    const result = await runAssistantTool(
      'search_products',
      JSON.stringify({ query: 'bicycle', sort: 'price_asc' }),
    )
    for (const event of result.events) {
      emit(event)
    }
    emit({
      type: 'text',
      delta: 'В каталоге Atelier нет велосипедов (bicycle). Есть мотоциклы в категории motorcycle — это другой тип техники. Могу показать мотоциклы, если нужно.',
    })
    return true
  }

  if (BUDGET_ONLY_RE.test(userText.trim()) && shown.length > 0) {
    const scope = inferSearchScopeFromShown(shown)
    const budgetMatch = userText.match(/(\d+[.,]?\d*)/)
    const maxPrice = budgetMatch !== null ? Number(budgetMatch[1].replace(',', '.')) : undefined
    const result = await runAssistantTool(
      'search_products',
      JSON.stringify({
        query: scope.query,
        ...(scope.category !== undefined ? { category: scope.category } : {}),
        ...(maxPrice !== undefined && Number.isFinite(maxPrice) ? { max_price: maxPrice } : {}),
        sort: 'price_asc',
      }),
    )
    for (const event of result.events) {
      emit(event)
    }
    const fm = result.forModel
    const rec = typeof fm === 'object' && fm !== null ? fm as Record<string, unknown> : undefined
    const nearest = Array.isArray(rec?.nearestAboveBudget) ? rec.nearestAboveBudget : []
    const products = Array.isArray(rec?.products) ? rec.products : []
    if (products.length > 0) {
      const first = products[0]
      if (isRecord(first) && typeof first.title === 'string' && typeof first.price === 'number') {
        emit({
          type: 'text',
          delta: `Цены фиксированные, торг недоступен. В пределе $${maxPrice} есть ${first.title} за $${first.price}.`,
        })
      }
    }
    else if (nearest.length > 0 && isRecord(nearest[0]) && typeof nearest[0].title === 'string' && typeof nearest[0].price === 'number') {
      emit({
        type: 'text',
        delta: `Цены фиксированные, за $${maxPrice} отдать не могу. Ближайший вариант — ${nearest[0].title} за $${nearest[0].price}.`,
      })
    }
    else {
      emit({
        type: 'text',
        delta: `Цены фиксированные. В каталоге нет позиций в пределе $${maxPrice}.`,
      })
    }
    return true
  }

  // "расскажи о них" while cards are shown → real get_product (never invent specs).
  if (shown.length > 0 && DETAILS_INTENT_RE.test(userText)) {
    const focus = matchShownProduct(userText, shown) ?? shown[0]
    if (focus !== undefined) {
      await emitProductDetails(focus.id, emit)
      return true
    }
  }

  // Bare ordinal "1" / "вариант 1": cart if last offer was cart, else product details.
  if (shown.length > 0 && ORDINAL_ONLY_RE.test(userText.trim())) {
    const focus = matchShownProduct(userText, shown)
    if (focus !== undefined) {
      if (lastAssistantOfferedCart(request)) {
        await emitCartFromId(focus.id, emit)
        return true
      }
      await emitProductDetails(focus.id, emit)
      return true
    }
  }

  // Affirm "да" after "хотите отзывы/подробнее?" → get_product on focused card.
  if (isAffirmation(userText) && lastAssistantOfferedDetails(request) && !lastAssistantOfferedCart(request)) {
    const focus = focusFromLastAssistant(request, shown) ?? shown[0]
    if (focus !== undefined) {
      await emitProductDetails(focus.id, emit)
      return true
    }
  }

  const wantsCart = CART_INTENT_RE.test(userText)
    || isBareCartAdd(userText)
    || (isAffirmation(userText) && lastAssistantOfferedCart(request))

  if (wantsCart) {
    const matched = matchShownProduct(userText, shown)
      ?? focusFromLastAssistant(request, shown)
    if (matched !== undefined) {
      await emitCartFromId(matched.id, emit)
      return true
    }

    if (isBareCartAdd(userText) || isAffirmation(userText) || CART_INTENT_RE.test(userText)) {
      if (shown.length === 1 && shown[0] !== undefined) {
        await emitCartFromId(shown[0].id, emit)
        return true
      }
      if (shown.length > 1) {
        emit({
          type: 'text',
          delta: `Какой товар добавить в корзину? ${listShown(shown)}.`,
        })
        return true
      }
      const offered = lastAssistant !== undefined
        ? extractOfferedProductQuery(lastAssistant.content)
        : undefined
      if (offered !== undefined) {
        await searchAndMaybeAdd(offered, emit, true)
        return true
      }
      emit({
        type: 'text',
        delta: 'Напишите точное название товара из каталога Atelier, который нужно добавить в корзину.',
      })
      return true
    }
  }

  // Short catalog token like "Brown" while cards are in context — never for new search queries
  // (e.g. "iphone x" must not match "Selfie Lamp with iPhone").
  if (shown.length > 0 && inferForcedSearchArgs(userText) === undefined) {
    const named = matchShownProduct(userText, shown)
    if (named !== undefined && userText.trim().length <= 40) {
      await emitProductDetails(named.id, emit)
      return true
    }
  }

  if (asksCheapest(userText) && shown.length > 0) {
    const scope = inferSearchScopeFromShown(shown)
    const result = await runAssistantTool(
      'search_products',
      JSON.stringify({
        query: scope.query,
        ...(scope.category !== undefined ? { category: scope.category } : {}),
        sort: 'price_asc',
      }),
    )
    for (const event of result.events) {
      emit(event)
    }
    const fm = result.forModel
    const rec = typeof fm === 'object' && fm !== null ? fm as Record<string, unknown> : undefined
    const products = Array.isArray(rec?.products) ? rec.products : []
    const first = products[0]
    if (isRecord(first) && typeof first.title === 'string' && typeof first.price === 'number') {
      emit({
        type: 'text',
        delta: `Самый недорогой вариант из каталога сейчас — ${first.title} за $${first.price}. Ниже ещё варианты по возрастанию цены.`,
      })
    }
    else {
      emit({
        type: 'text',
        delta: 'Не нашёл более дешёвых позиций в каталоге. Смотрите карточки выше или уточните категорию.',
      })
    }
    return true
  }

  return false
}

const CJK_RE = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/g
const CYR_OR_LATIN_RE = /[a-zа-яё]/gi

export function sanitizeAssistantText(text: string): string {
  const cjkCount = (text.match(CJK_RE) ?? []).length
  const readableCount = (text.match(CYR_OR_LATIN_RE) ?? []).length
  // Only discard the whole reply when CJK dominates; otherwise strip CJK and keep Russian/English.
  if (cjkCount > 20 && readableCount < cjkCount) {
    return 'Не удалось сформулировать ответ на вашем языке. Уточните запрос — отвечу по каталогу Atelier.'
  }
  return text
    .replace(CJK_RE, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\S\n]{2,}/g, ' ')
    .trim()
}

export function rewriteFinalAssistantText(options: {
  text: string
  cartAdds: ReadonlyArray<{ title: string; quantity: number }>
  searched: boolean
  shownTitles?: readonly string[]
}): string {
  const { cartAdds, searched } = options
  const text = sanitizeAssistantText(options.text)
  if (cartAdds.length > 0) {
    return cartAdds
      .map(item => `${item.title} добавлен в корзину (${item.quantity} шт.).`)
      .join(' ')
  }
  if (claimsCartSuccess(text)) {
    return 'В корзину ничего не добавлено: нужен товар из каталога Atelier. Выберите карточку выше или напишите точное название из нашего ассортимента.'
  }
  if (!searched && looksLikeInventedCatalogClaim(text)) {
    const shownTitles = options.shownTitles ?? []
    const grounded = shownTitles.some(title => title.length > 3 && text.toLowerCase().includes(title.toLowerCase()))
    if (!grounded) {
      return 'Могу рекомендовать только товары из каталога Atelier после поиска. Уточните запрос (например: «часы», «сумки») — найду актуальные позиции.'
    }
  }
  return text
}

/** Infer English catalog query from the current user message only (no budget bleed). */
export function inferForcedSearchArgs(userText: string): Record<string, unknown> | undefined {
  const text = userText.trim()
  if (text.length < 2 || AFFIRM_RE.test(text) || isBareCartAdd(text) || BUDGET_ONLY_RE.test(text)) {
    return undefined
  }
  if (isBicycleIntent(text)) {
    return undefined
  }

  const budget = text.match(/(?:до|under|below|за|max)?\s*\$?\s*(\d{2,5}(?:[.,]\d+)?)/i)
  const maxPrice = budget !== null && !BUDGET_ONLY_RE.test(text)
    ? Number(budget[1].replace(',', '.'))
    : undefined

  let query: string | undefined
  let category: string | undefined
  const lower = text.toLowerCase()
  const wantsAccessory = /чехол|case|заряд|charger|кабель|cable|accessor/i.test(lower)

  if (/iphone\s*x|айфон\s*x/.test(lower)) {
    query = 'iphone x'
    category = 'smartphones'
  }
  else if (/iphone|айфон/.test(lower)) {
    query = 'iphone'
    category = wantsAccessory ? undefined : 'smartphones'
  }
  else if (/телефон|smartphone/.test(lower)) {
    query = 'phone'
    category = 'smartphones'
  }
  else if (/\bphones?\b/.test(lower)) {
    query = 'phone'
    category = wantsAccessory ? undefined : 'smartphones'
  }
  else if (/час|watch/.test(lower)) {
    query = 'watch'
  }
  else if (/сумк|bag/.test(lower)) {
    query = 'bag'
  }
  else if (/мото|motorcycle/.test(lower)) {
    query = 'motorcycle'
  }
  else if (/^[a-z0-9][a-z0-9\s-]{1,40}$/i.test(text) && !/^(да|нет|ok|yes)$/i.test(text)) {
    query = text
  }

  if (query === undefined) {
    return undefined
  }

  const args: Record<string, unknown> = { query, sort: 'price_asc' }
  if (category !== undefined) {
    args.category = category
  }
  // Only attach max_price when this message itself states a budget limit (до/under), not "за 1000" alone as bargain.
  if (maxPrice !== undefined && Number.isFinite(maxPrice) && /до\s*\$?|under|below|до\s+\d/i.test(text)) {
    args.max_price = maxPrice
  }
  return args
}
