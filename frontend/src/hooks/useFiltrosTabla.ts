import { useCallback, useMemo, useState } from 'react'

export type DireccionOrden = 'asc' | 'desc'

/**
 * Filtros por columna al estilo Excel: cada columna tiene su lista de valores
 * tildables y se puede ordenar A→Z / Z→A.
 *
 * - Por dentro se guarda lo *destildado* de cada columna, no lo tildado. Así un
 *   valor que aparece después (otro día, otra carga, o al sacar el filtro de
 *   otra columna) se muestra por defecto en vez de quedar oculto sin que nadie
 *   lo haya destildado.
 * - Hacia afuera `seleccion(col)` sigue siendo lo tildado (`null` = sin filtro).
 * - Las opciones de una columna salen de las filas que pasan los filtros de las
 *   *otras* columnas (filtros en cascada, como Excel), más los valores
 *   destildados aunque hoy no aparezcan, para poder volver a tildarlos.
 *
 * ```ts
 * const f = useFiltrosTabla(eventos, {
 *   caballo: (e) => e.caballoNombre,
 *   estado:  (e) => LABEL_ESTADO[e.tipo],
 * })
 * f.filas            // filtradas y ordenadas
 * f.opciones('estado')
 * ```
 */
export function useFiltrosTabla<T, K extends string>(
  filas: T[],
  columnas: Record<K, (fila: T) => string | null | undefined>,
) {
  const [excluidos, setExcluidos] = useState<Partial<Record<K, Set<string>>>>({})
  const [orden, setOrden] = useState<{ columna: K; dir: DireccionOrden } | null>(null)

  const claves = useMemo(() => Object.keys(columnas) as K[], [columnas])
  const valor = useCallback(
    (fila: T, col: K) => columnas[col](fila) ?? '',
    [columnas],
  )

  const pasa = useCallback(
    (fila: T, excepto?: K) => claves.every((col) => {
      if (col === excepto) return true
      const excl = excluidos[col]
      return !excl || !excl.has(valor(fila, col))
    }),
    [claves, excluidos, valor],
  )

  const filtradas = useMemo(() => {
    const out = filas.filter((f) => pasa(f))
    if (!orden) return out
    const signo = orden.dir === 'asc' ? 1 : -1
    return [...out].sort((a, b) =>
      signo * valor(a, orden.columna).localeCompare(valor(b, orden.columna), 'es', { numeric: true }),
    )
  }, [filas, pasa, orden, valor])

  const opciones = useCallback((col: K): string[] => {
    const set = new Set<string>()
    for (const f of filas) if (pasa(f, col)) set.add(valor(f, col))
    for (const v of excluidos[col] ?? []) set.add(v)
    return [...set].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
  }, [filas, pasa, excluidos, valor])

  const seleccion = useCallback((col: K): Set<string> | null => {
    const excl = excluidos[col]
    if (!excl) return null
    return new Set(opciones(col).filter((v) => !excl.has(v)))
  }, [excluidos, opciones])

  /** Recibe lo tildado (como el popover) y guarda lo que quedó afuera. */
  const setSeleccion = useCallback((col: K, sel: Set<string> | null) => {
    const excl = sel ? opciones(col).filter((v) => !sel.has(v)) : []
    setExcluidos((prev) => ({ ...prev, [col]: excl.length ? new Set(excl) : undefined }))
  }, [opciones])

  const limpiar = useCallback(() => {
    setExcluidos({})
    setOrden(null)
  }, [])

  const activos = claves.filter((c) => excluidos[c]).length

  return {
    filas: filtradas,
    opciones,
    seleccion,
    setSeleccion,
    orden,
    setOrden,
    limpiar,
    /** Cantidad de columnas con filtro aplicado. */
    activos,
    hayCambios: activos > 0 || orden !== null,
  } as const
}
