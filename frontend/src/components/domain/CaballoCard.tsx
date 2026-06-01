import { ChevronRight, CheckSquare, Square } from 'lucide-react'
import { calcularEdadDetallada } from '../../utils/fecha'
import FotoCaballo from './FotoCaballo'

interface CaballoCardProps {
  caballo: {
    id: string
    nombre: string
    fecha_nacimiento?: string | null
    categoria?: string | null
    rol_reproductivo?: string | null
    numero_registro?: string | null
    cat_raza?: { nombre: string } | null
    cat_pelaje?: { nombre: string } | null
    campo?: { nombre: string } | null
  }
  onClick?: () => void
  seleccionado?: boolean
  onToggle?: () => void
  empresaNombre?: string
}

const CATEGORIA_STYLE: Record<string, string> = {
  Yegua:    'bg-pink-100 text-pink-700 ring-1 ring-pink-200',
  Padrillo: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
  Caballo:  'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  Potrillo: 'bg-brand-100 text-brand-700 ring-1 ring-brand-200',
}

const SUBCATEGORIA_STYLE: Record<string, string> = {
  Donante:   'bg-purple-100 text-purple-700 ring-1 ring-purple-200',
  Receptora: 'bg-teal-100 text-teal-700 ring-1 ring-teal-200',
}

export default function CaballoCard({ caballo, onClick, seleccionado, onToggle, empresaNombre }: CaballoCardProps) {
  const enModoSeleccion = onToggle !== undefined
  const badgeClass      = CATEGORIA_STYLE[caballo.categoria ?? ''] ?? CATEGORIA_STYLE['Caballo']
  const subBadgeClass   = caballo.rol_reproductivo ? SUBCATEGORIA_STYLE[caballo.rol_reproductivo] : undefined
  const edad            = calcularEdadDetallada(caballo.fecha_nacimiento)

  function handleClick() {
    if (enModoSeleccion) onToggle()
    else onClick?.()
  }

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
        seleccionado
          ? 'bg-brand-50/30 border-l-2 border-brand-500'
          : 'hover:bg-slate-100/60 border-l-2 border-transparent'
      }`}
    >
      {/* Checkbox en modo selección */}
      {enModoSeleccion && (
        <span className="shrink-0">
          {seleccionado
            ? <CheckSquare size={16} className="text-brand-600" />
            : <Square size={16} className="text-slate-400" />
          }
        </span>
      )}

      {/* Foto */}
      <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
        <FotoCaballo
          caballoId={caballo.id}
          nombre={caballo.nombre}
          canEdit={false}
          size={36}
        />
      </span>

      {/* Nombre + edad */}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-slate-900 truncate">{caballo.nombre}</span>
        <span className="block text-xs text-slate-400">
          {edad}
          {empresaNombre && <span className="ml-1.5 text-slate-400">· {empresaNombre}</span>}
        </span>
      </span>

      {/* Nro. Registro */}
      {caballo.numero_registro && (
        <span className="hidden sm:block text-xs text-slate-400 font-mono shrink-0">
          {caballo.numero_registro}
        </span>
      )}

      {/* Badges */}
      <span className="flex items-center gap-1.5 shrink-0">
        {caballo.categoria && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeClass}`}>
            {caballo.categoria}
          </span>
        )}
        {subBadgeClass && caballo.rol_reproductivo && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${subBadgeClass}`}>
            {caballo.rol_reproductivo}
          </span>
        )}
      </span>

      {/* Chevron */}
      {!enModoSeleccion && <ChevronRight size={14} className="shrink-0 text-slate-400" />}
    </button>
  )
}
