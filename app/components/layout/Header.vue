<script setup lang="ts">
import { ShoppingBag } from '@lucide/vue'
import { useCartStore } from '~/stores/cart'
import {
  openCartInjectionKey,
  useStorefrontWebMcpTools,
} from '~/composables/useStorefrontWebMcp'

const { search } = useCatalogFilter()
const { isDark, themeLabel, toggleTheme } = useTheme()
const cart = useCartStore()
const route = useRoute()
const router = useRouter()

const draft = ref(search.value)
const cartOpen = ref(false)
const cartMounted = ref(false)

const cartLabel = computed(() => `Корзина, товаров: ${cart.totalItems}`)

watch(search, (value) => {
  if (draft.value !== value) {
    draft.value = value
  }
})

watchDebounced(draft, (value) => {
  if (value !== search.value) {
    search.value = value
  }
}, { debounce: 300 })

function openCart() {
  cartMounted.value = true
  cartOpen.value = true
}

provide(openCartInjectionKey, openCart)
useStorefrontWebMcpTools({ openCart })

async function onSearchSubmit(event: Event) {
  event.preventDefault()
  const query = draft.value.trim()
  search.value = query

  const submitEvent = event as AgentSubmitEvent
  const targetPath = query === ''
    ? '/catalog'
    : { path: '/catalog', query: { search: query } }

  if (route.path !== '/catalog' || route.query.search !== (query || undefined)) {
    await router.push(targetPath)
  }

  if (submitEvent.agentInvoked && typeof submitEvent.respondWith === 'function') {
    submitEvent.respondWith(Promise.resolve({
      ok: true,
      search: query,
      path: '/catalog',
    }))
  }
}
</script>

<template>
  <header class="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur">
    <div class="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
      <div class="flex min-w-0 shrink-0 items-center gap-3 sm:gap-4">
        <NuxtLink
          to="/"
          class="rounded-sm text-lg font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Atelier
        </NuxtLink>
        <NuxtLink
          to="/catalog"
          class="rounded-sm text-sm text-muted-foreground transition-colors duration-200 ease-out hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Каталог
        </NuxtLink>
      </div>

      <form
        toolname="searchProducts"
        tooldescription="Search the Atelier product catalog by keyword and open the catalog results."
        toolautosubmit
        class="relative order-last w-full min-w-0 basis-full sm:order-none sm:mx-auto sm:max-w-md sm:flex-1 sm:basis-auto"
        @submit="onSearchSubmit"
      >
        <label
          for="catalog-search"
          class="sr-only"
        >
          Поиск товаров
        </label>
        <svg
          class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle
            cx="11"
            cy="11"
            r="8"
          />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <Input
          id="catalog-search"
          v-model="draft"
          name="search"
          type="search"
          placeholder="Поиск"
          class="pl-8"
          autocomplete="off"
          toolparamdescription="Keyword or product name to search for in the catalog."
        />
      </form>

      <div class="ml-auto flex shrink-0 items-center gap-2">
        <ClientOnly>
          <Button
            type="button"
            variant="outline"
            size="icon"
            :aria-label="themeLabel"
            :aria-pressed="isDark"
            @click="toggleTheme"
          >
            <svg
              v-if="isDark"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="4"
              />
              <path d="M12 2v2" />
              <path d="M12 20v2" />
              <path d="m4.93 4.93 1.41 1.41" />
              <path d="m17.66 17.66 1.41 1.41" />
              <path d="M2 12h2" />
              <path d="M20 12h2" />
              <path d="m6.34 17.66-1.41 1.41" />
              <path d="m19.07 4.93-1.41 1.41" />
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          </Button>
          <template #fallback>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled
              aria-label="Переключить тему"
            />
          </template>
        </ClientOnly>

        <Button
          type="button"
          variant="outline"
          size="icon"
          class="relative"
          :aria-label="cartLabel"
          @click="openCart"
        >
          <ShoppingBag aria-hidden="true" />
          <ClientOnly>
            <Badge
              v-if="cart.totalItems > 0"
              class="absolute -right-2 -top-2 min-w-5 justify-center px-1"
              aria-live="polite"
            >
              {{ cart.totalItems }}
            </Badge>
          </ClientOnly>
        </Button>

        <LazyCartSheet
          v-if="cartMounted"
          v-model:open="cartOpen"
        />
      </div>
    </div>
  </header>
</template>
