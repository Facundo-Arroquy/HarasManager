import type { RefObject } from 'react'
import { ChevronDown, X } from 'lucide-react'

// ── Dropdown multi-select reutilizable ────────────────────────────────────────

interface FiltroDropdownProps {
  label: string
  seleccionados: Set<string>
  opciones: { id: string; nombre: string }[]
  show: boolean
  onToggleShow: () => void
  onToggleOpcion: (id: string) => void
  onLimpiar: () => void
  textoTodos: string
  textoUno: (id: string) => string
  textoMultiple: (n: number) => string
  containerRef: RefObject<HTMLDivElement | null>
  minWidth: string
}

/**
 * Filtro de selección múltiple con etiqueta, usado por Caballos (empresa,
 * campo, camada) y Embriones (empresa dueña). Sin selección = no filtra.
 * Es controlado: el padre guarda `seleccionados` (ver `useSetFilter`) y si el
 * menú está abierto, y cierra el menú con `useOutsideClick(containerRef, …)`.
 */
export default function FiltroDropdown({
  label, seleccionados, opciones, show, onToggleShow, onToggleOpcion, onLimpiar,
  textoTodos, textoUno, textoMultiple, containerRef, minWidth,
}: FiltroDropdownProps) {
  const textoBoton =
    seleccionados.size === 0 ? textoTodos
    : seleccionados.size === 1 ? textoUno(Array.from(seleccionados)[0])
    : textoMultiple(seleccionados.size)

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider shrink-0">{label}</span>
      <div className="relative" ref={containerRef}>
        <button
          onClick={onToggleShow}
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            seleccionados.size > 0
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700'
          }`}
        >
          {textoBoton}
          <ChevronDown size={12} className={`transition-transform ${show ? 'rotate-180' : ''}`} />
        </button>
        {show && (
          <div className={`absolute top-full mt-1 left-0 z-20 ${minWidth} rounded-xl border border-slate-200 bg-white shadow-lg py-1`}>
            {opciones.map((op) => (
              <label
                key={op.id}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={seleccionados.has(op.id)}
                  onChange={() => onToggleOpcion(op.id)}
                  className="rounded border-slate-300"
                />
                {op.nombre}
              </label>
            ))}
          </div>
        )}
      </div>
      {seleccionados.size > 0 && (
        <button
          onClick={onLimpiar}
          className="rounded-lg border border-slate-300 p-1.5 text-slate-400 hover:text-slate-600 hover:border-slate-400 transition-colors"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}
