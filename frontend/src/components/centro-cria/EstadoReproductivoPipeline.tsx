import { useEffect, useRef, useState } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import {
  PASOS_DONANTE,
  PASOS_RECEPTORA,
  LABEL_ESTADO,
  type EstadoReproductivo,
} from '../../types/crianza'
import { getTransiciones } from '../../utils/estadoMaquina'

interface Props {
  rol:      'Donante' | 'Receptora'
  estado:   EstadoReproductivo
  canEdit?: boolean
  onCambiar?: (nuevoEstado: EstadoReproductivo) => Promise<void>
}

export default function EstadoReproductivoPipeline({ rol, estado, canEdit, onCambiar }: Props) {
  const pasos     = rol === 'Donante' ? PASOS_DONANTE : PASOS_RECEPTORA
  const estaVacia = estado === 'vacia'
  const idxActual = estado && !estaVacia ? pasos.indexOf(estado as any) : -1

  const siguientes  = canEdit ? getTransiciones(rol, estado) : []
  const [open,      setOpen]    = useState(false)
  const [guardando, setGuardando] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function elegirEstado(nuevo: EstadoReproductivo) {
    if (!onCambiar) return
    setOpen(false)
    setGuardando(true)
    try {
      await onCambiar(nuevo)
    } finally {
      setGuardando(false)
    }
  }

  // ── Badge especial "Vacía" ─────────────────────────────────────────────────
  if (estaVacia) {
    return (
      <div className="flex items-center gap-2 px-4 pb-3 pt-0.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
          Vacía
        </span>
        {canEdit && siguientes.length > 0 && (
          <CambiarDropdown
            ref={ref}
            open={open}
            guardando={guardando}
            siguientes={siguientes}
            onToggle={() => setOpen((v) => !v)}
            onElegir={elegirEstado}
          />
        )}
      </div>
    )
  }

  // ── Pipeline lineal ───────────────────────────────────────────────────────
  return (
    <div className="flex items-center gap-2 px-4 pb-3 pt-0.5">
      {/* Pasos */}
      <div className="overflow-x-auto scrollbar-none flex-1">
        <ol className="flex items-center gap-0 min-w-max">
          {pasos.map((paso, idx) => {
            const esPasado = idxActual > idx
            const esActual = idxActual === idx
            const esUltimo = idx === pasos.length - 1

            return (
              <li key={paso} className="flex items-center">
                {esPasado && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200">
                    <Check size={10} className="text-slate-500" strokeWidth={2.5} />
                  </span>
                )}
                {esActual && (
                  <span
                    className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
                      rol === 'Donante'
                        ? 'bg-purple-100 text-purple-700 ring-purple-200'
                        : 'bg-teal-100 text-teal-700 ring-teal-200'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${rol === 'Donante' ? 'bg-purple-500' : 'bg-teal-500'}`} />
                    {LABEL_ESTADO[paso]}
                  </span>
                )}
                {idxActual < idx && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-200" />
                )}
                {!esUltimo && (
                  <span className={`mx-1 h-px w-3 shrink-0 ${esPasado ? 'bg-slate-300' : 'bg-slate-200'}`} />
                )}
              </li>
            )
          })}
        </ol>

        {idxActual === -1 && (
          <span className="text-[11px] text-slate-400">Sin estado</span>
        )}
      </div>

      {/* Botón cambiar estado */}
      {canEdit && siguientes.length > 0 && (
        <CambiarDropdown
          ref={ref}
          open={open}
          guardando={guardando}
          siguientes={siguientes}
          onToggle={() => setOpen((v) => !v)}
          onElegir={elegirEstado}
        />
      )}
    </div>
  )
}

// ── Dropdown de próximos estados ─────────────────────────────────────────────

interface DropdownProps {
  open:      boolean
  guardando: boolean
  siguientes: EstadoReproductivo[]
  onToggle:  () => void
  onElegir:  (e: EstadoReproductivo) => void
  ref: React.RefObject<HTMLDivElement | null>
}

function CambiarDropdown({ open, guardando, siguientes, onToggle, onElegir, ref }: DropdownProps) {
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={onToggle}
        disabled={guardando}
        title="Cambiar estado"
        className={`flex items-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
          guardando
            ? 'cursor-wait text-slate-300'
            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
        }`}
      >
        {guardando ? '…' : (
          <>
            <ChevronRight size={12} />
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-7 z-20 min-w-[130px] rounded-lg border border-slate-200 bg-white py-1 shadow-md">
          <p className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Avanzar a
          </p>
          {siguientes.map((sig) => (
            <button
              key={sig as string}
              onClick={() => onElegir(sig)}
              className="w-full px-3 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {LABEL_ESTADO[sig as string] ?? sig}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
