/**
 * Register a WebMCP imperative tool while the caller is mounted.
 * No-ops when `document.modelContext` is unavailable (SSR / unsupported browsers).
 */
export function useWebMcpTool(
  tool: MaybeRefOrGetter<WebMcpToolDefinition | null>,
): void {
  const controller = shallowRef<AbortController | null>(null)

  async function syncTool(): Promise<void> {
    controller.value?.abort()
    controller.value = null

    if (!import.meta.client) {
      return
    }

    const definition = toValue(tool)
    const modelContext
      = document.modelContext
        ?? (navigator as Navigator & { modelContext?: ModelContext }).modelContext
    if (!definition || !modelContext?.registerTool) {
      return
    }

    const next = new AbortController()
    controller.value = next
    try {
      await modelContext.registerTool(definition, { signal: next.signal })
    }
    catch (error) {
      if (!next.signal.aborted) {
        console.warn('[webmcp] registerTool failed', definition.name, error)
      }
    }
  }

  onMounted(() => {
    void syncTool()
  })

  watch(
    () => toValue(tool),
    () => {
      void syncTool()
    },
    { deep: true },
  )

  onBeforeUnmount(() => {
    controller.value?.abort()
    controller.value = null
  })
}
