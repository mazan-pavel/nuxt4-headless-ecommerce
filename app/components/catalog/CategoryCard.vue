<script setup lang="ts">
import type { Category } from '#shared/types/product'

withDefaults(defineProps<{
  category: Category
  image?: string | null
}>(), {
  image: null,
})
</script>

<template>
  <NuxtLink
    :to="`/catalog?category=${category.slug}`"
    class="group relative block aspect-[4/3] overflow-hidden rounded-xl border border-border/60 bg-muted transition-colors duration-200 ease-out hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <NuxtImg
      v-if="image"
      :src="image"
      :alt="category.name"
      width="480"
      height="360"
      fit="cover"
      sizes="sm:50vw md:33vw lg:25vw"
      loading="lazy"
      class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
    />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
    <span class="absolute inset-x-0 bottom-0 p-3 text-sm font-medium text-white sm:p-4 sm:text-base">
      {{ category.name }}
    </span>
  </NuxtLink>
</template>
