/**
 * Theme toggle via `html.dark` class (matches shadcn CSS variables).
 */
export function useTheme() {
  const isDark = useDark({
    selector: 'html',
    attribute: 'class',
    valueDark: 'dark',
    valueLight: '',
    storageKey: 'nuxt4-shadcn-color-mode',
  })

  const themeLabel = computed(() =>
    isDark.value ? 'Переключить на светлую тему' : 'Переключить на тёмную тему',
  )

  function toggleTheme() {
    const next = !isDark.value
    isDark.value = next

    if (import.meta.client) {
      document.documentElement.classList.toggle('dark', next)
    }
  }

  return {
    isDark,
    themeLabel,
    toggleTheme,
  }
}
