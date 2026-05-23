import { ChevronRight, CheckSquare, Square } from 'lucide-react'
import { calcularEdadDetallada } from '../../utils/fecha'
import FotoCaballo from './FotoCaballo'

interface CaballoCardProps {
  caballo: {
    id: string
    nombre: string
    fecha_nacimiento?: string | null
    categoria?: string | null
    subcategoria?: string | null
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
  Yegua:    'bg-pink-950 text-pink-300 ring-1 ring-pink-800',
  Padrillo: 'bg-blue-950 text-blue-300 ring-1 ring-blue-800',
  Caballo:  'bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700',
  Potrillo: 'bg-amber-950 text-amber-300 ring-1 ring-amber-800',
}

const SUBCATEGORIA_STYLE: Record<string, string> = {
  Donante:   'bg-purple-950 text-purple-300 ring-1 ring-purple-800',
  Receptora: 'bg-teal-950 text-teal-300 ring-1 ring-teal-800',
}

export default function CaballoCard({ caballo, onClick, seleccionado, onToggle, empresaNombre }: CaballoCardProps) {
  const enModoSeleccion = onToggle !== undefined
  const badgeClass      = CATEGORIA_STYLE[caballo.categoria ?? ''] ?? CATEGORIA_STYLE['Caballo']
  const subBadgeClass   = caballo.subcategoria ? SUBCATEGORIA_STYLE[caballo.subcategoria] : undefined
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
          ? 'bg-emerald-950/30 border-l-2 border-emerald-600'
          : 'hover:bg-zinc-800/60 border-l-2 border-transparent'
      }`}
    >
      {/* Checkbox en modo selección */}
      {enModoSeleccion && (
        <span className="shrink-0">
          {seleccionado
            ? <CheckSquare size={16} className="text-emerald-400" />
            : <Square size={16} className="text-zinc-600" />
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
        <span className="block text-sm font-medium text-zinc-100 truncate">{caballo.nombre}</span>
        <span className="block text-xs text-zinc-500">
          {edad}
          {empresaNombre && <span className="ml-1.5 text-zinc-600">· {empresaNombre}</span>}
        </span>
      </span>

      {/* Nro. Registro */}
      {caballo.numero_registro && (
        <span className="hidden sm:block text-xs text-zinc-600 font-mono shrink-0">
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
        {subBadgeClass && caballo.subcategoria && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${subBadgeClass}`}>
            {caballo.subcategoria}
          </span>
        )}
      </span>

      {/* Chevron */}
      {!enModoSeleccion && <ChevronRight size={14} className="shrink-0 text-zinc-600" />}
    </button>
  )
}
