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

type PadrilloItem = {
  id: string
  nombre: string
  empresa: string | null
}

const ESTADIOS = ['Mórula', 'Blastocisto temprano', 'Blastocisto', 'Blastocisto expandido'] as const
const TAMANIOS = ['Pequeño', 'Mediano', 'Grande'] as const
const GRADOS   = [1, 2, 3, 4] as const

const HOY = new Date().toISOString().split('T')[0]

export default function FlushingModal({ onClose, onSuccess, recordatorio, caballoIdInicial }: Props) {
  const { user, sociedadActiva } = useAuth()
  const { crearFlushing, actualizarEstadoRecordatorio } = useCrianzaStore()

  const [animales,   setAnimales]   = useState<AnimalItem[]>([])
  const [padrillos,  setPadrillos]  = useState<PadrilloItem[]>([])
  const [cargando,   setCargando]   = useState(true)

  // Form
  const [caballoId,   setCaballoId]   = useState(caballoIdInicial ?? recordatorio?.caballo_id ?? '')
  const [fecha,       setFecha]       = useState(recordatorio?.fecha_vto ?? HOY)
  const [esNegativo,  setEsNegativo]  = useState(false)
  const [cantidad,    setCantidad]    = useState('')
  const [estadio,     setEstadio]     = useState<string>('')
  const [grado,       setGrado]       = useState<number | ''>('')
  const [tamanio,     setTamanio]     = useState<string>('')
  const [padrilloIds,   setPadrilloIds]   = useState<string[]>([''])
  const [padrilloTextos, setPadrilloTextos] = useState<string[]>([''])
  const [pgGiven,     setPgGiven]     = useState(false)
  const [notas,       setNotas]       = useState('')

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  // Para el rol 'veterinario', sociedadActiva es null (vet global sin sociedad fija).
  // En ese caso derivamos el sociedad_id del recordatorio o del caballoIdInicial.
  const efectivaSociedadId = sociedadActiva?.id ?? recordatorio?.sociedad_id ?? ''

  const donantes = animales.filter((a) => a.rol_reproductivo === 'Donante')

  useEffect(() => {
    if (!efectivaSociedadId) return

    async function cargar() {
      try {
        const animalesData = await crianzaService.listarAnimalesReproductivos(efectivaSociedadId)
        setAnimales(animalesData as AnimalItem[])

        // Intentar cargar padrillos de todas las sociedades del vet
        try {
          const vetData = await crianzaService.listarAnimalesReproductivosVet()
          const vetPadrillos = (vetData as { id: string; nombre: string; categoria: string; marca?: { nombre: string } | null }[])
            .filter((a) => a.categoria === 'Padrillo')
          setPadrillos(vetPadrillos.length > 0
            ? vetPadrillos.map((a) => ({ id: a.id, nombre: a.nombre, empresa: a.marca?.nombre ?? null }))
            : (animalesData as AnimalItem[])
                .filter((a) => a.categoria === 'Padrillo')
                .map((a) => ({ id: a.id, nombre: a.nombre, empresa: null })))
        } catch {
          // Fallback: padrillos solo de la sociedad del recordatorio
          setPadrillos((animalesData as AnimalItem[])
            .filter((a) => a.categoria === 'Padrillo')
            .map((a) => ({ id: a.id, nombre: a.nombre, empresa: null })))
        }
      } finally {
        setCargando(false)
      }
    }

    cargar()
  }, [efectivaSociedadId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Sincronizar largo de los arrays de padrillos con la cantidad de embriones
  useEffect(() => {
    if (esNegativo) {
      setPadrilloIds([''])
      setPadrilloTextos([''])
      return
    }
    const n = Math.max(1, Number(cantidad) || 1)
    const resize = (prev: string[]) => {
      if (prev.length === n) return prev
      const next = [...prev]
      while (next.length < n) next.push('')
      return next.slice(0, n)
    }
    setPadrilloIds(resize)
    setPadrilloTextos(resize)
  }, [cantidad, esNegativo])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!caballoId)          return setError('Seleccioná la donante.')
    if (!fecha)              return setError('La fecha es requerida.')
    if (!user?.id || !efectivaSociedadId) return

    if (!esNegativo && !cantidad) return setError('Indicá la cantidad de embriones (o marcá como negativo).')

    setSaving(true)
    try {
      // Padrillos con texto libre (sin ID) se guardan en notas
      const textosLibres = padrilloTextos
        .map((t, i) => (t.trim() && !padrilloIds[i] ? `Embrión ${i + 1}: ${t.trim()}` : null))
        .filter(Boolean)
      const notasFinales = [notas.trim(), ...textosLibres].filter(Boolean).join(' | ') || null

      const flushing = await crearFlushing({
        caballo_id:            caballoId,
        sociedad_id:           efectivaSociedadId,
        fecha,
        veterinario_id:        user.id,
        es_negativo:           esNegativo,
        cantidad:              esNegativo ? null : Number(cantidad),
        padrillo_id:           padrilloIds.find((id) => id) || null,
        origen_recordatorio_id: recordatorio?.id ?? null,
        pg_given:              pgGiven,
        cancelado:             false,
        notas:                 notasFinales,
      })

      // Crear N filas en embrion (una por embrión recuperado)
      if (!esNegativo && Number(cantidad) > 0) {
        const n = Number(cantidad)
        const embriones = Array.from({ length: n }, (_, i) => ({
          flushing_id:        flushing.id,
          caballo_donante_id: caballoId,
          sociedad_id:        efectivaSociedadId,
          padrillo_id:        padrilloIds[i] || null,
          estadio:            estadio || null,
          grado:              grado !== '' ? (grado as 1 | 2 | 3 | 4) : null,
          tamanio:            tamanio || null,
          zona_pelucida:      null,
          estado:             'disponible' as const,
          notas:              null,
        }))
        await crianzaService.crearEmbriones(embriones)
      }

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
      <div className="w-full max-w-md sm:mx-4 rounded-t-2xl sm:rounded-xl border border-slate-300 bg-white shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <Droplets size={16} className="text-brand-600" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Registrar flushing</h2>
              {donanteSeleccionada && (
                <p className="text-xs text-slate-500 mt-0.5">{donanteSeleccionada.nombre}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
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
              <label className="text-xs font-medium text-slate-500">Donante *</label>
              <select
                value={caballoId}
                onChange={(e) => setCaballoId(e.target.value)}
                disabled={cargando || !!caballoIdInicial || !!recordatorio?.caballo_id}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60"
              >
                <option value="">— Seleccioná —</option>
                {donantes.map((d) => (
                  <option key={d.id} value={d.id}>{d.nombre}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Fecha *</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Negativo */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={esNegativo}
              onChange={(e) => setEsNegativo(e.target.checked)}
              className="rounded border-slate-400 bg-slate-100 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm text-slate-600">Flushing negativo (sin embriones)</span>
          </label>

          {/* Resultado — solo si no es negativo */}
          {!esNegativo && (
            <>
              {/* Cantidad */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Embriones recuperados *</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  placeholder="0"
                  className="w-24 rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {/* Estadio + Grado + Tamaño */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Estadio</label>
                  <select
                    value={estadio}
                    onChange={(e) => setEstadio(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="">—</option>
                    {ESTADIOS.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Grado</label>
                  <select
                    value={grado}
                    onChange={(e) => setGrado(e.target.value === '' ? '' : Number(e.target.value) as 1|2|3|4)}
                    className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="">—</option>
                    {GRADOS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Tamaño</label>
                  <select
                    value={tamanio}
                    onChange={(e) => setTamanio(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="">—</option>
                    {TAMANIOS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Padrillos — un selector por embrión */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500">
                  {padrilloIds.length === 1 ? 'Padrillo' : 'Padrillos'}
                </label>
                {padrilloIds.map((pid, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      {padrilloIds.length > 1 && (
                        <span className="text-xs text-slate-400 w-16 shrink-0">Embrión {i + 1}</span>
                      )}
                      <select
                        value={pid}
                        onChange={(e) => {
                          const next = [...padrilloIds]
                          next[i] = e.target.value
                          // Si selecciona del dropdown, limpiar el texto libre
                          if (e.target.value) {
                            const textos = [...padrilloTextos]
                            textos[i] = ''
                            setPadrilloTextos(textos)
                          }
                          setPadrilloIds(next)
                        }}
                        className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        <option value="">— Sin especificar —</option>
                        {padrillos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}{p.empresa ? ` (${p.empresa})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* Texto libre: visible solo cuando no hay selección del dropdown */}
                    {!pid && (
                      <input
                        type="text"
                        value={padrilloTextos[i] ?? ''}
                        onChange={(e) => {
                          const next = [...padrilloTextos]
                          next[i] = e.target.value
                          setPadrilloTextos(next)
                        }}
                        placeholder="O escribí el nombre si no está en la lista"
                        className={`w-full rounded-md border bg-slate-50 px-3 py-1.5 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500 ${padrilloIds.length > 1 ? 'ml-[4.5rem]' : ''} border-slate-200`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* PG + Notas */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={pgGiven}
              onChange={(e) => setPgGiven(e.target.checked)}
              className="rounded border-slate-400 bg-slate-100 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm text-slate-600">PG administrada</span>
          </label>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Notas</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Observaciones adicionales…"
              className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600">
              <AlertCircle size={13} />
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="flushing-form"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-md bg-brand-500 hover:bg-brand-400 text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar flushing'}
          </button>
        </div>
      </div>
    </div>
  )
}
