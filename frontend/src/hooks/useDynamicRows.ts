import { useCallback, useRef, useState } from 'react'

/**
 * Gestiona una lista dinámica de filas con `tempId` interno.
 *
 * ```ts
 * const { rows, addRow, removeRow, updateRow, setRows } = useDynamicRows<ParteRow>({
 *   parteCuerpoId: '', lado: 'no aplica', descripcion: '',
 * })
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useDynamicRows<T extends Record<string, any>>(defaultRow: Omit<T, 'tempId'>) {
  type Row = T & { tempId: string }
  const counter = useRef(0)
  const uid = () => String(++counter.current)

  const [rows, setRows] = useState<Row[]>([])

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, { tempId: uid(), ...defaultRow } as Row])
  // defaultRow es estable por convención — se pasa como literal en el call site
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const removeRow = useCallback((tempId: string) => {
    setRows((prev) => prev.filter((r) => r.tempId !== tempId))
  }, [])

  const updateRow = useCallback(<K extends keyof T>(tempId: string, key: K, value: T[K]) => {
    setRows((prev) => prev.map((r) => r.tempId === tempId ? { ...r, [key]: value } : r))
  }, [])

  return { rows, setRows, addRow, removeRow, updateRow } as const
}
