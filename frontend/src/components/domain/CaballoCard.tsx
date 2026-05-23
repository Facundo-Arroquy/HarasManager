import { useNavigate } from 'react-router-dom'
import { Stethoscope, ChevronRight, Pencil } from 'lucide-react'
import { calcularEdad } from '../../utils/fecha'
import type { Campo } from '../../services/campoService'

interface CaballoCardProps {
  caballo: {
    id: string
    nombre: string
    fecha_nacimiento?: string | null
    categoria?: string | null
    raza_id?: number | null
    pelaje_id?: number | null
    numero_chip?: string | null
    numero_registro?: string | null
    campo_id?: string | null
    cat_raza?: { nombre: string } | null
    cat_pelaje?: { nombre: string } | null
    campo?: { nombre: string } | null
  }
  onEditar?: () => void
  campos?: Campo[]
  onCampoChange?: (campoId: string) => void
}

const CATEGORIA_STYLE: Record<string, string> = {
  Yegua:    'bg-pink-950 text-pink-300 ring-1 ring-pink-800',
  Padrillo: 'bg-blue-950 text-blue-300 ring-1 ring-blue-800',
  Caballo:  'bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700',
  Potrillo: 'bg-amber-950 text-amber-300 ring-1 ring-amber-800',
}

export default function CaballoCard({ caballo, onEditar, campos, onCampoChange }: CaballoCardProps) {
  const navigate   = useNavigate()
  const badgeClass = CATEGORIA_STYLE[caballo.categoria ?? ''] ?? CATEGORIA_STYLE['Caballo']

  return (
    <div className="group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900 p-4 gap-3 transition-colors hover:border-zinc-700">
      {/* Nombre + badge */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-zinc-100 leading-tight">
          {caballo.nombre}
        </h3>
        {caballo.categoria && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeClass}`}>
            {caballo.categoria}
          </span>
        )}
      </div>

      {/* Detalles */}
      <dl className="space-y-1 text-xs text-zinc-400">
        {caballo.cat_raza && (
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">Raza</dt>
            <dd className="text-zinc-300 text-right">{caballo.cat_raza.nombre}</dd>
          </div>
        )}
        {caballo.cat_pelaje && (
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">Pelaje</dt>
            <dd className="text-zinc-300">{caballo.cat_pelaje.nombre}</dd>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500">Edad</dt>
          <dd className="text-zinc-300">{calcularEdad(caballo.fecha_nacimiento)}</dd>
        </div>
        {caballo.numero_chip && (
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">Chip</dt>
            <dd className="font-mono text-zinc-400 text-[10px]">{caballo.numero_chip}</dd>
          </div>
        )}
      </dl>

      {/* Selector de campo inline */}
      {onCampoChange && campos && campos.length > 0 && (
        <select
          defaultValue={(caballo as any).campo_id ?? ''}
          onChange={(e) => onCampoChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-emerald-600"
        >
          <option value="">Sin campo</option>
          {campos.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      )}

      {/* Acciones */}
      <div className="mt-auto flex flex-col gap-2">
        <button
          onClick={() => navigate(`/caballos/${caballo.id}/historial`)}
          className="flex items-center justify-between rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-400 transition-colors hover:border-emerald-700 hover:bg-emerald-950 hover:text-emerald-300"
        >
          <span className="flex items-center gap-1.5">
            <Stethoscope size={13} />
            Ver historial clínico
          </span>
          <ChevronRight size={13} />
        </button>

        {onEditar && (
          <button
            onClick={onEditar}
            className="flex items-center justify-between rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <span className="flex items-center gap-1.5">
              <Pencil size={13} />
              Editar
            </span>
            <ChevronRight size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
