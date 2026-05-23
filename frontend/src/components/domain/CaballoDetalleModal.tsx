import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Stethoscope, Pencil, MapPin } from 'lucide-react'
import { calcularEdad } from '../../utils/fecha'

interface Caballo {
  id: string
  nombre: string
  fecha_nacimiento?: string | null
  categoria?: string | null
  subcategoria?: string | null
  campo_id?: string | null
  numero_chip?: string | null
  numero_registro?: string | null
  cat_raza?: { nombre: string } | null
  cat_pelaje?: { nombre: string } | null
  campo?: { nombre: string } | null
}

interface Props {
  caballo: Caballo
  puedeEditar: boolean
  onClose: () => void
  onEditar: () => void
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

export default function CaballoDetalleModal({ caballo, puedeEditar, onClose, onEditar }: Props) {
  const navigate    = useNavigate()
  const badgeClass  = CATEGORIA_STYLE[caballo.categoria ?? ''] ?? CATEGORIA_STYLE['Caballo']
  const subClass    = caballo.subcategoria ? SUBCATEGORIA_STYLE[caballo.subcategoria] : undefined

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full sm:max-w-md mx-0 sm:mx-4 rounded-t-2xl sm:rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-zinc-800">
          <div className="min-w-0 pr-3">
            <h2 className="text-base font-semibold text-zinc-100 truncate">{caballo.nombre}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {caballo.categoria && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeClass}`}>
                  {caballo.categoria}
                </span>
              )}
              {subClass && caballo.subcategoria && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${subClass}`}>
                  {caballo.subcategoria}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 text-zinc-500 hover:text-zinc-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Detalles */}
        <dl className="px-5 py-4 space-y-2.5 text-sm">
          <Row label="Edad"    value={calcularEdad(caballo.fecha_nacimiento)} />
          {caballo.cat_raza   && <Row label="Raza"   value={caballo.cat_raza.nombre} />}
          {caballo.cat_pelaje && <Row label="Pelaje" value={caballo.cat_pelaje.nombre} />}
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">Campo</dt>
            <dd className="text-zinc-300 flex items-center gap-1">
              {caballo.campo
                ? <><MapPin size={12} className="text-emerald-500" />{caballo.campo.nombre}</>
                : <span className="text-zinc-600">Sin asignar</span>
              }
            </dd>
          </div>
          {caballo.numero_chip && (
            <Row label="Chip" value={caballo.numero_chip} mono />
          )}
          {caballo.numero_registro && (
            <Row label="Registro" value={caballo.numero_registro} mono />
          )}
        </dl>

        {/* Acciones */}
        <div className="px-5 pb-5 space-y-2">
          <button
            onClick={() => { onClose(); navigate(`/caballos/${caballo.id}/historial`) }}
            className="w-full flex items-center justify-between rounded-lg border border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-300 transition-colors hover:border-emerald-700 hover:bg-emerald-950 hover:text-emerald-300"
          >
            <span className="flex items-center gap-2">
              <Stethoscope size={15} /> Ver historial clínico
            </span>
            <span className="text-zinc-600">→</span>
          </button>

          {puedeEditar && (
            <button
              onClick={() => { onClose(); onEditar() }}
              className="w-full flex items-center justify-between rounded-lg border border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-200"
            >
              <span className="flex items-center gap-2">
                <Pencil size={15} /> Editar
              </span>
              <span className="text-zinc-600">→</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-zinc-500">{label}</dt>
      <dd className={`text-zinc-300 ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  )
}
