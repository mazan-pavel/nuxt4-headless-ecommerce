/**
 * Inject one or more JSON-LD graphs into the document head.
 * Accepts reactive values so SSR and client updates stay in sync.
 */
export function useJsonLd(
  schemas: MaybeRefOrGetter<Record<string, unknown> | Record<string, unknown>[] | null | undefined>,
) {
  useHead(() => {
    const value = toValue(schemas)
    if (value == null) {
      return {}
    }
    const list = Array.isArray(value) ? value : [value]
    if (list.length === 0) {
      return {}
    }
    return {
      script: list.map(schema => ({
        type: 'application/ld+json' as const,
        children: JSON.stringify(schema),
      })),
    }
  })
}
