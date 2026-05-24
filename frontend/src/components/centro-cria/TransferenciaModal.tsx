import { useEffect, useState } from 'react'
import { X, AlertCircle, ArrowLeftRight } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useCrianzaStore } from '../../store/crianzaStore'
import { crianzaService } from '../../services/crianzaService'
import type { Flushing } from '../../types/crianza'

interface Props {
  onClose: () => void
  onSuccess?: () => void
  // Flushing de origen (pre-carga donante + padrillo)
  flushing?: Flushing
  // Si viene de un flushing ya guardado pero sin objeto completo
  flushingId?: string
  donantePredId?: string
  padrilloPreId?: string
}

type AnimalItem = {
  id: string
  nombre: string
  categoria: string
  rol_reproductivo: 'Donante' | 'Receptora' | null
}

const CL_CALIDADES = ['Excelente', 'Buena', 'Regular', 'Mala'] as const
const TONOS        = ['Excelente', 'Bueno', 'Regular', 'Malo'] as const

const HOY = new Date().toISOString().split('T')[0]

export default function TransferenciaModal({
  onClose, onSuccess, flushing, flushingId, donantePredId, padrilloPreId,
}: Props) {
  const { user, sociedadActiva } = useAuth()
  const { crearRegistro, crearTransferencia } = useCrianzaStore()

  const [animales, setAnimales] = useState<AnimalItem[]>([])
  const [cargando, setCargando] = useState(true)

  // Derivados de flushing prop
  const donantePredId_ = flushing?.caballo_id ?? donantePredId ?? ''
  const padrilloPreId_ = flushing?.padrillo_id ?? padrilloPreId ?? ''
  const flushingId_    = flushing?.id ?? flushingId ?? ''

  // Form
  const [receptoraId,   setReceptoraId]   = useState('')
  const [donanteId,     setDonanteId]     = useState(donantePredId_)
  const [padrilloId,    setPadrilloId]    = useState(padrilloPreId_)
  const [fecha,         setFecha]         = useState(HOY)
  const [clCalidad,     setClCalidad]     = useState<string>('')
  const [tonoUterino,   setTonoUterino]   = useState<string>('')
  const [tonoCervical,  setTonoCervical]  = useState<string>('')
  const [clasificacion, setClasificacion] = useState<'Fresco' | 'Congelado' | ''>('')
  const [notas,         setNotas]         = useState('')

  // Ovarios de la receptora al momento de la transferencia
  const [ovIzq, setOvIzq] = useState<string>('CLV')   // cuerpo lúteo lo más común
  const [ovDer, setOvDer] = useState<string>('Chico')

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const receptoras = animales.filter((a) => a.rol_reproductivo === 'Receptora')
  const donantes   = animales.filter((a) => a.rol_reproductivo === 'Donante')
  const padrillos  = animales.filter((a) => a.categoria === 'Padrillo')

  useEffect(() => {
    if (!sociedadActiva) return
    crianzaService.listarAnimalesReproductivos(sociedadActiva.id)
      .then((data) => setAnimales(data as AnimalItem[]))
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [sociedadActiva])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!receptoraId)  return setError('Seleccioná la receptora.')
    if (!donanteId)    return setError('Seleccioná la donante.')
    if (!fecha)        return setError('La fecha es requerida.')
    if (!user?.id || !sociedadActiva) return

    setSaving(true)
    try {
      // 1. Crear registro clínico de la receptora con chip "Transferida"
      const registro = await crearRegistro(
        {
          caballo_id:         receptoraId,
          sociedad_id:        sociedadActiva.id,
          fecha,
          veterinario_id:     user.id,
          ovario_izq:         ovIzq ? [ovIzq] : [],
          ovario_der:         ovDer ? [ovDer] : [],
          utero:              [],
          obs_chips:          ['Transferida'],
          padrillo_id:        null,
          ov_dias:            null,
          review_manana:      false,
          review_manana_desc: null,
          motivo:             null,
          diagnostico:        null,
          tratamiento:        null,
          observaciones:      notas.trim() || null,
        },
        'Receptora'
      )

      // 2. Crear la transferencia vinculada a ese registro
      await crearTransferencia({
        sociedad_id:          sociedadActiva.id,
        fecha,
        veterinario_id:       user.id,
        registro_id:          registro.id,
        caballo_receptora_id: receptoraId,
        caballo_donante_id:   donanteId,
        padrillo_id:          padrilloId || null,
        flushing_id:          flushingId_ || null,
        cl_calidad:           clCalidad || null,
        tono_uterino:         tonoUterino || null,
        tono_cervical:        tonoCervical || null,
        clasificacion:        clasificacion || null,
        notas:                notas.trim() || null,
      })

      onSuccess?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar.')
    } finally {
      setSaving(false)
    }
  }

  const receptoraSelec = animales.find((a) => a.id === receptoraId)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md sm:mx-4 rounded-t-2xl sm:rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <ArrowLeftRight size={15} className="text-blue-400" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Transferencia embrionaria</h2>
              {receptoraSelec && (
                <p className="text-xs text-zinc-400 mt-0.5">{receptoraSelec.nombre}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form
          id="transferencia-form"
          onSubmit={handleSubmit}
          className="overflow-y-auto flex-1 px-5 py-4 space-y-4"
        >
          {/* Receptora + Fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-xs font-medium text-zinc-400">Receptora *</label>
              <select
                value={receptoraId}
                onChange={(e) => setReceptoraId(e.target.value)}
                disabled={cargando}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
              >
                <option value="">— Seleccioná —</option>
                {receptoras.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
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

          {/* Donante + Padrillo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Donante *</label>
              <select
                value={donanteId}
                onChange={(e) => setDonanteId(e.target.value)}
                disabled={!!donantePredId_}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
              >
                <option value="">— Seleccioná —</option>
                {donantes.map((d) => (
                  <option key={d.id} value={d.id}>{d.nombre}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Padrillo</label>
              <select
                value={padrilloId}
                onChange={(e) => setPadrilloId(e.target.value)}
                disabled={!!padrilloPreId_}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
              >
                <option value="">— Sin especificar —</option>
                {padrillos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Ovarios de la receptora (estado al momento de la transferencia) */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-400">Estado ovárico de la receptora</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500">Ovario izquierdo</label>
                <input
                  type="text"
                  value={ovIzq}
                  onChange={(e) => setOvIzq(e.target.value)}
                  placeholder="CLV"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500">Ovario derecho</label>
                <input
                  type="text"
                  value={ovDer}
                  onChange={(e) => setOvDer(e.target.value)}
                  placeholder="Chico"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Separador */}
          <div className="border-t border-zinc-800" />

          {/* Condición reproductiva */}
          <p className="text-xs font-medium text-zinc-400">Condición reproductiva</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-500">Calidad CL</label>
              <select
                value={clCalidad}
                onChange={(e) => setClCalidad(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">—</option>
                {CL_CALIDADES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-500">Tono uterino</label>
              <select
                value={tonoUterino}
                onChange={(e) => setTonoUterino(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">—</option>
                {TONOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-500">Tono cervical</label>
              <select
                value={tonoCervical}
                onChange={(e) => setTonoCervical(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">—</option>
                {TONOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-500">Clasificación embrión</label>
              <select
                value={clasificacion}
                onChange={(e) => setClasificacion(e.target.value as 'Fresco' | 'Congelado' | '')}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">—</option>
                <option value="Fresco">Fresco</option>
                <option value="Congelado">Congelado</option>
              </select>
            </div>
          </div>

          {/* Notas */}
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

          {/* Info: qué se va a crear */}
          <div className="rounded-md border border-zinc-700 bg-zinc-800/50 p-3 space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Se va a crear</p>
            <p className="text-xs text-zinc-400">
              • Registro clínico de la receptora con chip <span className="text-violet-300">Transferida</span>
            </p>
            <p className="text-xs text-zinc-400">
              • Registro de transferencia embrionaria
            </p>
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
            form="transferencia-form"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Registrar transferencia'}
          </button>
        </div>
      </div>
    </div>
  )
}
