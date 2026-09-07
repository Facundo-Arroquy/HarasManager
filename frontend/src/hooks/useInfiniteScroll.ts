import { useEffect, useRef, useState, startTransition } from 'react'

/**
 * Infinite scroll con IntersectionObserver.
 *
 * Retorna `visibleCount` (cuántos items mostrar), un `sentinelRef` para
 * colocar al final de la lista, y `hayMas` para saber si quedan items.
 *
 * Se resetea automáticamente cuando `totalLength` cambia.
 */
export function useInfiniteScroll(totalLength: number, pageSize = 24) {
  const [visibleCount, setVisibleCount] = useState(pageSize)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Reset cuando cambian los datos
  useEffect(() => { setVisibleCount(pageSize) }, [totalLength, pageSize])

  // Observer
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          startTransition(() => {
            setVisibleCount((prev) => Math.min(prev + pageSize, totalLength))
          })
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [totalLength, pageSize])

  return { visibleCount, sentinelRef, hayMas: visibleCount < totalLength } as const
}
