import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ClipboardList, Pencil, MapPin } from 'lucide-react'
import { calcularEdad } from '../../utils/fecha'
import { useAuth } from '../../hooks/useAuth'
import { caballoService } from '../../services/caballoService'

interface Caballo {
  id: string
  nombre: string
  fecha_nacimiento?: string | null
  categoria?: string | null
  rol_reproductivo?: string | null
  prenada?: boolean | null
  fecha_prenez?: string | null
  campo_id?: string | null
  numero_chip?: string | null
  numero_registro?: string | null
  cat_raza?: { nombre: string } | null
  cat_pelaje?: { nombre: string } | null
  campo?: { nombre: string } | null
  empresa_nombre?: string | null
  propietario_nombre?: string | null
}

interface Props {
  caballo: Caballo
  puedeEditar: boolean
  onClose: () => void
  onEditar: () => void
  onRefresh?: () => void
}

const CATEGORIA_STYLE: Record<string, string> = {
  Yegua:    'bg-pink-950 text-pink-700 ring-1 ring-pink-800',
  Padrillo: 'bg-blue-950 text-blue-700 ring-1 ring-blue-800',
  Caballo:  'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  Potrillo: 'bg-brand-950 text-brand-700 ring-1 ring-brand-800',
}

const SUBCATEGORIA_STYLE: Record<string, string> = {
  Donante:   'bg-purple-950 text-purple-700 ring-1 ring-purple-800',
  Receptora: 'bg-teal-950 text-teal-700 ring-1 ring-teal-800',
}

export default function CaballoDetalleModal({ caballo, puedeEditar, onClose, onEditar, onRefresh }: Props) {
  const navigate    = useNavigate()
  const { rol }     = useAuth()
  const badgeClass  = CATEGORIA_STYLE[caballo.categoria ?? ''] ?? CATEGORIA_STYLE['Caballo']
  const subClass    = caballo.rol_reproductivo ? SUBCATEGORIA_STYLE[caballo.rol_reproductivo] : undefined

  const esYegua      = caballo.categoria === 'Yegua'
  const puedePrenada = esYegua && (rol === 'admin' || rol === 'veterinario')

  const [prenada,       setPrenada]       = useState(caballo.prenada ?? false)
  const [fechaPrenez,   setFechaPrenez]   = useState(caballo.fecha_prenez ?? '')
  // "baseline" = último valor confirmado guardado. Se actualiza solo al guardar con éxito.
  const [baselinePren,  setBaselinePren]  = useState(caballo.prenada ?? false)
  const [baselineFecha, setBaselineFecha] = useState(caballo.fecha_prenez ?? '')
  const [prenSaving,    setPrenSaving]    = useState(false)
  const [prenError,     setPrenError]     = useState('')
  const [prenOk,        setPrenOk]        = useState(false)

  // Hay cambios respecto al último guardado confirmado (no respecto al prop original)
  const cambiosPren = prenada !== baselinePren || fechaPrenez !== baselineFecha

  async function guardarPrenada() {
    setPrenSaving(true)
    setPrenError('')
    setPrenOk(false)
    try {
      await caballoService.togglePrenada(
        caballo.id,
        prenada,
        prenada ? (fechaPrenez || null) : null,
        rol === 'veterinario',
      )
      // Guardar exitoso: actualizar baseline para que el botón desaparezca
      setBaselinePren(prenada)
      setBaselineFecha(prenada ? fechaPrenez : '')
      setPrenOk(true)
      onRefresh?.()
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e !== null && 'message' in e
            ? String((e as { message: unknown }).message)
            : 'Error inesperado al guardar'
      setPrenError(msg)
    } finally {
      setPrenSaving(false)
    }
  }

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
      <div className="w-full sm:max-w-md mx-0 sm:mx-4 rounded-t-2xl sm:rounded-xl border border-slate-300 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-200">
          <div className="min-w-0 pr-3">
            <h2 className="text-base font-semibold text-slate-900 truncate">{caballo.nombre}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {caballo.categoria && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeClass}`}>
                  {caballo.categoria}
                </span>
              )}
              {subClass && caballo.rol_reproductivo && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${subClass}`}>
                  {caballo.rol_reproductivo}
                </span>
              )}
              {esYegua && prenada && (
                <span className="rounded-full px-2 py-0.5 text-[11px] font-medium bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
                  Preñada
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 text-slate-400 hover:text-slate-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Detalles */}
        <dl className="px-5 py-4 space-y-2.5 text-sm">
          <Row label="Edad"    value={calcularEdad(caballo.fecha_nacimiento)} />
          {caballo.empresa_nombre     && <Row label="Empresa" value={caballo.empresa_nombre} />}
          {caballo.propietario_nombre && <Row label="Propietario" value={caballo.propietario_nombre} />}
          {caballo.cat_raza   && <Row label="Raza"   value={caballo.cat_raza.nombre} />}
          {caballo.cat_pelaje && <Row label="Pelaje" value={caballo.cat_pelaje.nombre} />}
          <div className="flex justify-between gap-2">
            <dt className="text-slate-400">Campo</dt>
            <dd className="text-slate-600 flex items-center gap-1">
              {caballo.campo
                ? <><MapPin size={12} className="text-brand-500" />{caballo.campo.nombre}</>
                : <span className="text-slate-400">Sin asignar</span>
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

        {/* Toggle preñada — solo Yegua, solo admin/vet */}
        {puedePrenada && (
          <div className={`mx-5 mb-3 rounded-lg border px-4 py-3 ${prenada ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${prenada ? 'text-emerald-800' : 'text-slate-600'}`}>Preñada</p>
                <p className="text-xs text-slate-400">Gestación activa</p>
              </div>
              {/* Toggle switch */}
              <button
                type="button"
                onClick={() => { setPrenada((v) => !v); if (prenada) setFechaPrenez('') }}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${prenada ? 'bg-emerald-500' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${prenada ? 'translate-x-4' : 'translate-x-1'}`} />
              </button>
            </div>
            {prenada && (
              <div className="mt-2.5">
                <label className="block text-[11px] font-medium text-emerald-700 mb-1">Fecha de preñez</label>
                <input
                  type="date"
                  value={fechaPrenez}
                  onChange={(e) => setFechaPrenez(e.target.value)}
                  className="w-full rounded-md border border-emerald-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>
            )}
            {prenOk && !cambiosPren && (
              <p className="mt-2 text-xs text-emerald-600 font-medium">✓ Guardado</p>
            )}
            {prenError && (
              <p className="mt-2 text-xs text-rose-600">{prenError}</p>
            )}
            {cambiosPren && (
              <div className="mt-2.5 flex justify-end">
                <button
                  type="button"
                  onClick={guardarPrenada}
                  disabled={prenSaving}
                  className="px-3 py-1 text-xs font-medium rounded-md bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors"
                >
                  {prenSaving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Acciones */}
        <div className="px-5 pb-5 space-y-2">
          <button
            onClick={() => { onClose(); navigate(`/caballos/${caballo.id}/historial`) }}
            className="w-full flex items-center justify-between rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:border-emerald-700 hover:bg-brand-50 hover:text-brand-500"
          >
            <span className="flex items-center gap-2">
              <ClipboardList size={15} /> Ver Ficha
            </span>
            <span className="text-slate-400">→</span>
          </button>

          {puedeEditar && (
            <button
              onClick={() => { onClose(); onEditar() }}
              className="w-full flex items-center justify-between rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-500 transition-colors hover:border-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <span className="flex items-center gap-2">
                <Pencil size={15} /> Editar
              </span>
              <span className="text-slate-400">→</span>
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
      <dt className="text-slate-400">{label}</dt>
      <dd className={`text-slate-600 ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  )
}
