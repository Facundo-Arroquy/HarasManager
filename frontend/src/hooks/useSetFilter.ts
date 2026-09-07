import { useCallback, useState } from 'react'

/**
 * Filtro basado en `Set<T>` con toggle, clear y has.
 *
 * ```ts
 * const empresas = useSetFilter<string>()
 * empresas.toggle('abc-123')
 * empresas.has('abc-123') // true
 * empresas.clear()
 * ```
 */
export function useSetFilter<T = string>() {
  const [set, setSet] = useState<Set<T>>(new Set())

  const toggle = useCallback((id: T) => {
    setSet((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clear = useCallback(() => setSet(new Set()), [])

  const has = useCallback((id: T) => set.has(id), [set])

  return { set, setSet, toggle, clear, has, size: set.size } as const
}
