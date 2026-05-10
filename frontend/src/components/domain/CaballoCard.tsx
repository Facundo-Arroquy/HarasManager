import { useNavigate } from 'react-router-dom'
import { Stethoscope, ChevronRight, ArrowLeftRight } from 'lucide-react'
import { calcularEdad } from '../../utils/fecha'

interface CaballoCardProps {
  caballo: {
    id: string
    nombre: string
    fecha_nacimiento?: string | null
    categoria?: string | null
    numero_chip?: string | null
    marca_id?: string | null
    marca?: { nombre: string } | null
    cat_raza?: { nombre: string } | null
    cat_pelaje?: { nombre: string } | null
  }
  canTransfer?: boolean
  onTransferir?: () => void
}

const CATEGORIA_STYLE: Record<string, string> = {
  Yegua:    'bg-pink-950 text-pink-300 ring-1 ring-pink-800',
  Padrillo: 'bg-blue-950 text-blue-300 ring-1 ring-blue-800',
  Caballo:  'bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700',
  Potrillo: 'bg-amber-950 text-amber-300 ring-1 ring-amber-800',
}

export default function CaballoCard({ caballo, canTransfer, onTransferir }: CaballoCardProps) {
  const navigate  = useNavigate()
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

        {canTransfer && onTransferir && (
          <button
            onClick={onTransferir}
            className="flex items-center justify-between rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-400 transition-colors hover:border-amber-700 hover:bg-amber-950 hover:text-amber-300"
          >
            <span className="flex items-center gap-1.5">
              <ArrowLeftRight size={13} />
              Transferir propiedad
            </span>
            <ChevronRight size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
