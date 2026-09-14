import { useCallback, useMemo, useState } from 'react'

export type DireccionOrden = 'asc' | 'desc'

/**
 * Filtros por columna al estilo Excel: cada columna tiene su lista de valores
 * tildables y se puede ordenar A→Z / Z→A.
 *
 * - `null` en una columna = sin filtro (todo tildado).
 * - Las opciones de una columna salen de las filas que pasan los filtros de las
 *   *otras* columnas (filtros en cascada, como Excel), más los valores que ya
 *   estén tildados aunque hoy no aparezcan, para poder destildarlos.
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
  const [seleccion, setSeleccionState] = useState<Partial<Record<K, Set<string>>>>({})
  const [orden, setOrden] = useState<{ columna: K; dir: DireccionOrden } | null>(null)

  const claves = useMemo(() => Object.keys(columnas) as K[], [columnas])
  const valor = useCallback(
    (fila: T, col: K) => columnas[col](fila) ?? '',
    [columnas],
  )

  const pasa = useCallback(
    (fila: T, excepto?: K) => claves.every((col) => {
      if (col === excepto) return true
      const sel = seleccion[col]
      return !sel || sel.has(valor(fila, col))
    }),
    [claves, seleccion, valor],
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
    for (const v of seleccion[col] ?? []) set.add(v)
    return [...set].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
  }, [filas, pasa, seleccion, valor])

  const setSeleccion = useCallback((col: K, sel: Set<string> | null) => {
    setSeleccionState((prev) => ({ ...prev, [col]: sel ?? undefined }))
  }, [])

  const limpiar = useCallback(() => {
    setSeleccionState({})
    setOrden(null)
  }, [])

  const activos = claves.filter((c) => seleccion[c]).length

  return {
    filas: filtradas,
    opciones,
    seleccion: (col: K) => seleccion[col] ?? null,
    setSeleccion,
    orden,
    setOrden,
    limpiar,
    /** Cantidad de columnas con filtro aplicado. */
    activos,
    hayCambios: activos > 0 || orden !== null,
  } as const
}
