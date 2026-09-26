<script setup lang="ts">
const cart = useCartStore()

useSeoMeta({
  title: 'Оформление заказа',
  description: 'Доставка и оплата заказа из корзины.',
  ogTitle: 'Оформление заказа',
  ogDescription: 'Доставка и оплата заказа из корзины.',
})

const money = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'USD',
})

const name = ref('')
const email = ref('')
const phone = ref('')
const address = ref('')
const payment = ref<'card' | 'cash'>('card')
const isSubmitting = ref(false)
const orderId = ref('')

function discountedUnit(price: number, discountPercentage: number): number {
  return price * (1 - discountPercentage / 100)
}

async function submitOrder() {
  if (isSubmitting.value || cart.totalItems === 0) {
    return
  }
  isSubmitting.value = true
  await new Promise<void>(resolve => {
    setTimeout(resolve, 1000)
  })
  orderId.value = `#ORD-${Math.floor(10000 + Math.random() * 90000)}`
  cart.clearCart()
  isSubmitting.value = false
}
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-3xl font-semibold tracking-tight">
      Оформление заказа
    </h1>

    <ClientOnly>
      <div
        v-if="orderId !== ''"
        class="flex min-h-[24rem] flex-col items-start justify-center gap-4"
      >
        <p class="text-lg font-medium">
          Заказ успешно оформлен
        </p>
        <p>Номер заказа: {{ orderId }}</p>
        <Button
          as-child
          class="rounded-lg active:scale-[0.98]"
        >
          <NuxtLink to="/">
            Вернуться на главную
          </NuxtLink>
        </Button>
      </div>

      <CartEmptyState
        v-else-if="cart.totalItems === 0"
        class="min-h-[24rem]"
      />

      <form
        v-else
        class="grid gap-8 lg:grid-cols-2"
        @submit.prevent="submitOrder"
      >
        <fieldset class="space-y-4">
          <legend class="text-lg font-semibold">
            Доставка
          </legend>
          <div class="space-y-1">
            <label
              class="text-sm"
              for="checkout-name"
            >Имя</label>
            <Input
              id="checkout-name"
              v-model="name"
              name="name"
              autocomplete="name"
              required
            />
          </div>
          <div class="space-y-1">
            <label
              class="text-sm"
              for="checkout-email"
            >Email</label>
            <Input
              id="checkout-email"
              v-model="email"
              name="email"
              type="email"
              autocomplete="email"
              required
            />
          </div>
          <div class="space-y-1">
            <label
              class="text-sm"
              for="checkout-phone"
            >Телефон</label>
            <Input
              id="checkout-phone"
              v-model="phone"
              name="phone"
              type="tel"
              autocomplete="tel"
              required
            />
          </div>
          <div class="space-y-1">
            <label
              class="text-sm"
              for="checkout-address"
            >Адрес доставки</label>
            <Input
              id="checkout-address"
              v-model="address"
              name="address"
              autocomplete="street-address"
              required
            />
          </div>
          <fieldset class="space-y-2">
            <legend class="text-sm">
              Способ оплаты
            </legend>
            <label class="flex items-center gap-2 text-sm">
              <input
                v-model="payment"
                type="radio"
                name="payment"
                value="card"
                required
              >
              Карта
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input
                v-model="payment"
                type="radio"
                name="payment"
                value="cash"
              >
              Наличные
            </label>
          </fieldset>
        </fieldset>

        <section
          class="space-y-4"
          aria-labelledby="order-summary-heading"
        >
          <h2
            id="order-summary-heading"
            class="text-lg font-semibold"
          >
            Сводка заказа
          </h2>
          <ul class="space-y-3">
            <li
              v-for="item in cart.items"
              :key="item.id"
              class="flex gap-3"
            >
              <span class="block size-16 shrink-0 aspect-square overflow-hidden rounded-xl bg-muted">
                <NuxtImg
                  :src="item.thumbnail"
                  :alt="item.title"
                  width="64"
                  height="64"
                  fit="cover"
                  sizes="64px"
                  loading="lazy"
                  class="size-full object-cover"
                />
              </span>
              <div class="min-w-0">
                <p class="line-clamp-2 text-sm font-medium">
                  {{ item.title }}
                </p>
                <p class="text-sm text-muted-foreground">
                  {{ item.quantity }} × {{ money.format(discountedUnit(item.price, item.discountPercentage)) }}
                </p>
              </div>
            </li>
          </ul>
          <p class="flex justify-between text-sm">
            <span>Сумма</span>
            <span>{{ money.format(cart.totalPrice) }}</span>
          </p>
          <p class="flex justify-between text-sm font-medium">
            <span>Со скидкой</span>
            <span>{{ money.format(cart.discountedTotal) }}</span>
          </p>
          <Button
            type="submit"
            class="w-full rounded-lg active:scale-[0.98]"
            :disabled="isSubmitting"
            :aria-busy="isSubmitting"
          >
            Подтвердить заказ
          </Button>
        </section>
      </form>

      <template #fallback>
        <Skeleton class="min-h-[24rem] w-full" />
      </template>
    </ClientOnly>
  </div>
</template>
