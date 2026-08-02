import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Ban, X } from 'lucide-react'

export interface PadrilloOpcion {
  id:     string
  nombre: string
}

interface Props {
  padrillos: PadrilloOpcion[]
  value: string
  onChange: (id: string) => void
  /** padrillo_id → parentesco ('Padre', 'Hermano', …). Los familiares se bloquean. */
  familiares?: Record<string, string>
  /** Ids ordenados por prioridad (índice 0 = prioridad 1). */
  ranking?: string[]
  placeholder?: string
}

/**
 * Selector de padrillo para la inseminación.
 *
 * Dos reglas de Gero (2026-08-02) viven acá:
 *  - los familiares directos de la donante se muestran con etiqueta roja y no
 *    se pueden elegir (la regla también está en un trigger de la DB);
 *  - los padrillos del ranking de esa donante van primero, con su prioridad.
 */
export default function PadrilloSelect({
  padrillos, value, onChange, familiares = {}, ranking = [], placeholder = '— Seleccioná padrillo —',
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const prioridades = useMemo(
    () => new Map(ranking.map((id, i) => [id, i + 1])),
    [ranking],
  )

  // Ranking primero (por prioridad), después el resto alfabético.
  const ordenados = useMemo(() => {
    return [...padrillos].sort((a, b) => {
      const pa = prioridades.get(a.id) ?? Infinity
      const pb = prioridades.get(b.id) ?? Infinity
      if (pa !== pb) return pa - pb
      return a.nombre.localeCompare(b.nombre)
    })
  }, [padrillos, prioridades])

  const filtrados = query.trim()
    ? ordenados.filter((p) => p.nombre.toLowerCase().includes(query.toLowerCase()))
    : ordenados

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const seleccionado = padrillos.find((p) => p.id === value) ?? null

  return (
    <div className="space-y-1.5 relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setQuery('') }}
        className={`w-full flex items-center justify-between rounded-md border px-3 py-2 text-sm text-left transition-colors
          ${open ? 'border-brand-500 bg-slate-100' : 'border-slate-300 bg-slate-100 hover:border-slate-400'}
          ${seleccionado ? 'text-slate-700' : 'text-slate-400'}`}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          {seleccionado && prioridades.has(seleccionado.id) && (
            <span className="shrink-0 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
              #{prioridades.get(seleccionado.id)}
            </span>
          )}
          <span className="truncate">{seleccionado ? seleccionado.nombre : placeholder}</span>
        </span>
        <ChevronDown size={13} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 rounded-md border border-slate-300 bg-white shadow-xl">
          <div className="p-2 border-b border-slate-200">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
              placeholder="Buscar padrillo…"
              className="w-full bg-transparent text-sm text-slate-700 placeholder-slate-300 focus:outline-none"
            />
          </div>

          <div className="max-h-56 overflow-y-auto">
            {filtrados.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">Sin padrillos</p>
            ) : (
              filtrados.map((p) => {
                const parentesco = familiares[p.id]
                const prioridad  = prioridades.get(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={Boolean(parentesco)}
                    onMouseDown={() => { if (!parentesco) { onChange(p.id); setOpen(false) } }}
                    title={parentesco ? `${parentesco} de la donante — no se puede inseminar` : undefined}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors
                      ${parentesco
                        ? 'cursor-not-allowed bg-red-50/60 text-slate-400'
                        : value === p.id
                          ? 'text-brand-600 hover:bg-slate-100'
                          : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      {prioridad && (
                        <span className="shrink-0 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                          #{prioridad}
                        </span>
                      )}
                      <span className="truncate">{p.nombre}</span>
                    </span>
                    {parentesco && (
                      <span className="shrink-0 flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-red-200">
                        <Ban size={9} />
                        Familiar
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>

          {value && (
            <div className="border-t border-slate-200">
              <button
                type="button"
                onMouseDown={() => { onChange(''); setOpen(false) }}
                className="w-full flex items-center gap-1.5 px-3 py-2 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors text-left"
              >
                <X size={12} className="shrink-0" />
                Limpiar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
