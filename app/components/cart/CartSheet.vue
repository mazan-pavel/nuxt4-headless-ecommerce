<script setup lang="ts">
import { useCartStore } from '~/stores/cart'

const open = defineModel<boolean>('open', { required: true })

const cart = useCartStore()

const money = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'USD',
})

function discountedUnit(price: number, discountPercentage: number): number {
  return price * (1 - discountPercentage / 100)
}

function decrease(id: number, quantity: number) {
  cart.updateQuantity(id, quantity - 1)
}

function increase(id: number, quantity: number) {
  cart.updateQuantity(id, quantity + 1)
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent
      side="right"
      class="flex w-full flex-col gap-4 sm:max-w-md"
    >
      <SheetHeader>
        <SheetTitle>Корзина</SheetTitle>
        <SheetDescription class="sr-only">
          Список товаров в корзине
        </SheetDescription>
      </SheetHeader>

      <CartEmptyState v-if="cart.items.length === 0">
        <SheetClose as-child>
          <Button
            as-child
            class="rounded-lg active:scale-[0.98]"
          >
            <NuxtLink to="/catalog">
              Перейти в каталог
            </NuxtLink>
          </Button>
        </SheetClose>
      </CartEmptyState>

      <template v-else>
        <ScrollArea class="min-h-0 flex-1 pr-3">
          <ul class="space-y-4">
            <li
              v-for="item in cart.items"
              :key="item.id"
              class="flex gap-3"
            >
              <span class="block size-16 shrink-0 aspect-square overflow-hidden rounded-xl bg-muted">
                <NuxtImg
                  :src="item.thumbnail"
                  width="64"
                  height="64"
                  fit="cover"
                  sizes="64px"
                  loading="lazy"
                  :alt="item.title"
                  class="size-full object-cover"
                />
              </span>
              <div class="min-w-0 flex-1 space-y-2">
                <p class="line-clamp-2 text-sm font-medium">
                  {{ item.title }}
                </p>
                <p class="flex flex-wrap items-baseline gap-2 text-sm">
                  <span>{{ money.format(discountedUnit(item.price, item.discountPercentage)) }}</span>
                  <span
                    v-if="item.discountPercentage > 0"
                    class="text-muted-foreground line-through"
                  >
                    {{ money.format(item.price) }}
                  </span>
                </p>
                <div class="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    :aria-label="`Уменьшить количество ${item.title}`"
                    :disabled="item.quantity <= 1"
                    @click="decrease(item.id, item.quantity)"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14" />
                    </svg>
                  </Button>
                  <span class="min-w-6 text-center text-sm">{{ item.quantity }}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    :aria-label="`Увеличить количество ${item.title}`"
                    :disabled="item.quantity >= item.stock"
                    @click="increase(item.id, item.quantity)"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14" />
                      <path d="M12 5v14" />
                    </svg>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    class="ml-auto"
                    :aria-label="`Удалить ${item.title}`"
                    @click="cart.removeItem(item.id)"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                  </Button>
                </div>
              </div>
            </li>
          </ul>
        </ScrollArea>

        <Separator />

        <SheetFooter class="flex-col gap-3 sm:flex-col sm:gap-3">
          <p class="flex justify-between text-sm">
            <span>Сумма</span>
            <span
              aria-live="polite"
            >{{ money.format(cart.totalPrice) }}</span>
          </p>
          <p class="flex justify-between text-sm font-medium">
            <span>Со скидкой</span>
            <span
              aria-live="polite"
            >{{ money.format(cart.discountedTotal) }}</span>
          </p>
          <Button
            type="button"
            variant="outline"
            class="w-full"
            @click="cart.clearCart()"
          >
            Очистить корзину
          </Button>
          <SheetClose as-child>
            <Button
              as-child
              class="w-full rounded-lg active:scale-[0.98]"
            >
              <NuxtLink to="/checkout">
                Оформить заказ
              </NuxtLink>
            </Button>
          </SheetClose>
        </SheetFooter>
      </template>
    </SheetContent>
  </Sheet>
</template>
