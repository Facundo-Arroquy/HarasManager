import { useEffect, useState } from 'react'
import { X, AlertCircle, Droplets } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useCrianzaStore } from '../../store/crianzaStore'
import { crianzaService } from '../../services/crianzaService'
import type { RecordatorioCria } from '../../types/crianza'

interface Props {
  onClose: () => void
  onSuccess?: (flushingId: string) => void
  // Recordatorio "Flushing" que disparó este modal (opcional)
  recordatorio?: RecordatorioCria
  // Pre-seleccionar donante
  caballoIdInicial?: string
}

type AnimalItem = {
  id: string
  nombre: string
  categoria: string
  rol_reproductivo: 'Donante' | 'Receptora' | null
}

const ESTADIOS = ['Mórula', 'Blastocisto temprano', 'Blastocisto', 'Blastocisto expandido'] as const
const TAMANIOS = ['Pequeño', 'Mediano', 'Grande'] as const
const GRADOS   = [1, 2, 3, 4] as const

const HOY = new Date().toISOString().split('T')[0]

export default function FlushingModal({ onClose, onSuccess, recordatorio, caballoIdInicial }: Props) {
  const { user, sociedadActiva } = useAuth()
  const { crearFlushing, actualizarEstadoRecordatorio } = useCrianzaStore()

  const [animales, setAnimales] = useState<AnimalItem[]>([])
  const [cargando, setCargando] = useState(true)

  // Form
  const [caballoId,   setCaballoId]   = useState(caballoIdInicial ?? recordatorio?.caballo_id ?? '')
  const [fecha,       setFecha]       = useState(recordatorio?.fecha_vto ?? HOY)
  const [esNegativo,  setEsNegativo]  = useState(false)
  const [cantidad,    setCantidad]    = useState('')
  const [estadio,     setEstadio]     = useState<string>('')
  const [grado,       setGrado]       = useState<number | ''>('')
  const [tamanio,     setTamanio]     = useState<string>('')
  const [padrilloId,  setPadrilloId]  = useState('')
  const [pgGiven,     setPgGiven]     = useState(false)
  const [notas,       setNotas]       = useState('')

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const donantes  = animales.filter((a) => a.rol_reproductivo === 'Donante')
  const padrillos = animales.filter((a) => a.categoria === 'Padrillo')

  useEffect(() => {
    if (!sociedadActiva) return
    crianzaService.listarAnimalesReproductivos(sociedadActiva.id).then((data) => {
      setAnimales(data as AnimalItem[])
      setCargando(false)
    })
  }, [sociedadActiva])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!caballoId)     return setError('Seleccioná la donante.')
    if (!fecha)         return setError('La fecha es requerida.')
    if (!user?.id || !sociedadActiva) return

    if (!esNegativo && !cantidad) return setError('Indicá la cantidad de embriones (o marcá como negativo).')

    setSaving(true)
    try {
      const flushing = await crearFlushing({
        caballo_id:            caballoId,
        sociedad_id:           sociedadActiva.id,
        fecha,
        veterinario_id:        user.id,
        es_negativo:           esNegativo,
        cantidad:              esNegativo ? null : Number(cantidad),
        estadio:               estadio || null,
        grado:                 grado !== '' ? (grado as 1 | 2 | 3 | 4) : null,
        tamanio:               tamanio || null,
        zona_pelucida:         null,
        padrillo_id:           padrilloId || null,
        origen_recordatorio_id: recordatorio?.id ?? null,
        pg_given:              pgGiven,
        cancelado:             false,
        notas:                 notas.trim() || null,
      })

      // Marcar el recordatorio de origen como hecho
      if (recordatorio?.id) {
        await actualizarEstadoRecordatorio(recordatorio.id, 'hecho')
      }

      onSuccess?.(flushing.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar.')
    } finally {
      setSaving(false)
    }
  }

  const donanteSeleccionada = animales.find((a) => a.id === caballoId)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md sm:mx-4 rounded-t-2xl sm:rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <Droplets size={16} className="text-emerald-400" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Registrar flushing</h2>
              {donanteSeleccionada && (
                <p className="text-xs text-zinc-400 mt-0.5">{donanteSeleccionada.nombre}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form
          id="flushing-form"
          onSubmit={handleSubmit}
          className="overflow-y-auto flex-1 px-5 py-4 space-y-4"
        >
          {/* Donante + Fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-xs font-medium text-zinc-400">Donante *</label>
              <select
                value={caballoId}
                onChange={(e) => setCaballoId(e.target.value)}
                disabled={cargando || !!caballoIdInicial || !!recordatorio?.caballo_id}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
              >
                <option value="">— Seleccioná —</option>
                {donantes.map((d) => (
                  <option key={d.id} value={d.id}>{d.nombre}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Fecha *</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Negativo */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={esNegativo}
              onChange={(e) => setEsNegativo(e.target.checked)}
              className="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-sm text-zinc-300">Flushing negativo (sin embriones)</span>
          </label>

          {/* Resultado — solo si no es negativo */}
          {!esNegativo && (
            <>
              {/* Cantidad */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Embriones recuperados *</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  placeholder="0"
                  className="w-24 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Estadio + Grado + Tamaño */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Estadio</label>
                  <select
                    value={estadio}
                    onChange={(e) => setEstadio(e.target.value)}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">—</option>
                    {ESTADIOS.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Grado</label>
                  <select
                    value={grado}
                    onChange={(e) => setGrado(e.target.value === '' ? '' : Number(e.target.value) as 1|2|3|4)}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">—</option>
                    {GRADOS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Tamaño</label>
                  <select
                    value={tamanio}
                    onChange={(e) => setTamanio(e.target.value)}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">—</option>
                    {TAMANIOS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Padrillo */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Padrillo</label>
            <select
              value={padrilloId}
              onChange={(e) => setPadrilloId(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">— Sin especificar —</option>
              {padrillos.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          {/* PG + Notas */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={pgGiven}
              onChange={(e) => setPgGiven(e.target.checked)}
              className="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-sm text-zinc-300">PG administrada</span>
          </label>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Notas</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Observaciones adicionales…"
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400">
              <AlertCircle size={13} />
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-zinc-800 px-5 py-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="flushing-form"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar flushing'}
          </button>
        </div>
      </div>
    </div>
  )
}
