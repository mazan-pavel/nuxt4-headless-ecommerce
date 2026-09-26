<script setup lang="ts">
import Header from '~/components/layout/Header.vue'

const cartStore = useCartStore()
</script>

<template>
  <div class="relative flex min-h-screen flex-col bg-background text-foreground">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      К основному содержимому
    </a>

    <Header />

    <main
      id="main-content"
      tabindex="-1"
      class="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8"
    >
      <slot />
    </main>

    <div
      aria-live="polite"
      aria-atomic="true"
      class="sr-only"
    >
      {{ cartStore.lastAnnouncement }}
    </div>

    <footer class="border-t border-border">
      <div class="mx-auto w-full max-w-7xl px-4 py-4 text-sm text-muted-foreground sm:px-6 lg:px-8">
        <p>
          Atelier · учебный кейс на Nuxt 4 ·
          <a
            href="https://github.com/mazan-pavel/nuxt4-headless-ecommerce"
            class="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Репозиторий
          </a>
        </p>
      </div>
    </footer>
  </div>
</template>
