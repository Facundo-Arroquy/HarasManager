import { useEffect, useState } from 'react'
import { X, AlertCircle, ArrowLeftRight } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useCrianzaStore } from '../../store/crianzaStore'
import { crianzaService } from '../../services/crianzaService'
import type { Flushing, Embrion } from '../../types/crianza'

interface Props {
  onClose: () => void
  onSuccess?: () => void
  // Flushing de origen (pre-carga donante + padrillo)
  flushing?: Flushing
  // Si viene de un flushing ya guardado pero sin objeto completo
  flushingId?: string
  donantePredId?: string
  padrilloPreId?: string
  // Fallback para el rol 'veterinario' (sociedadActiva es null)
  sociedadId?: string
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

function labelEmbrion(e: Embrion, idx: number): string {
  const partes: string[] = [`#${idx + 1}`]
  if (e.estadio) partes.push(e.estadio)
  if (e.grado != null) partes.push(`G${e.grado}`)
  if (e.tamanio) partes.push(e.tamanio)
  if ((e.donante as any)?.nombre) partes.push(`— ${(e.donante as any).nombre}`)
  return partes.join(' · ')
}

export default function TransferenciaModal({
  onClose, onSuccess, flushing, flushingId, donantePredId, padrilloPreId, sociedadId,
}: Props) {
  const { user, sociedadActiva } = useAuth()
  const { crearRegistro, crearTransferencia } = useCrianzaStore()

  // Para el rol 'veterinario', sociedadActiva es null. Usar el prop sociedadId o el del flushing.
  const efectivaSociedadId = sociedadActiva?.id ?? flushing?.sociedad_id ?? sociedadId ?? ''

  const [animales,  setAnimales]  = useState<AnimalItem[]>([])
  const [embriones, setEmbriones] = useState<Embrion[]>([])
  const [cargando,  setCargando]  = useState(true)

  // Derivados de flushing prop
  const donantePredId_ = flushing?.caballo_id ?? donantePredId ?? ''
  const padrilloPreId_ = flushing?.padrillo_id ?? padrilloPreId ?? ''
  const flushingId_    = flushing?.id ?? flushingId ?? ''

  // Form
  const [receptoraId,   setReceptoraId]   = useState('')
  const [donanteId,     setDonanteId]     = useState(donantePredId_)
  const [embrionId,     setEmbrionId]     = useState('')
  const [padrilloId,    setPadrilloId]    = useState(padrilloPreId_)
  const [fecha,         setFecha]         = useState(HOY)
  const [clCalidad,     setClCalidad]     = useState<string>('')
  const [tonoUterino,   setTonoUterino]   = useState<string>('')
  const [tonoCervical,  setTonoCervical]  = useState<string>('')
  const [clasificacion, setClasificacion] = useState<'Fresco' | 'Congelado' | ''>('')
  const [notas,         setNotas]         = useState('')

  // Ovarios de la receptora al momento de la transferencia
  const [ovIzq, setOvIzq] = useState<string>('CLV')
  const [ovDer, setOvDer] = useState<string>('Chico')

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const receptoras = animales.filter((a) => a.rol_reproductivo === 'Receptora')
  const donantes   = animales.filter((a) => a.rol_reproductivo === 'Donante')
  const padrillos  = animales.filter((a) => a.categoria === 'Padrillo')

  // Carga animales
  useEffect(() => {
    if (!efectivaSociedadId) return
    crianzaService.listarAnimalesReproductivos(efectivaSociedadId)
      .then((data) => setAnimales(data as AnimalItem[]))
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [efectivaSociedadId])

  // Carga embriones disponibles cuando cambia la donante
  useEffect(() => {
    if (!efectivaSociedadId) return
    setEmbrionId('')
    crianzaService.listarEmbrionesDisponibles(efectivaSociedadId, donanteId || undefined)
      .then(setEmbriones)
      .catch(() => setEmbriones([]))
  }, [efectivaSociedadId, donanteId])

  // Cuando se selecciona un embrión, auto-fill padrillo
  useEffect(() => {
    if (!embrionId) return
    const emb = embriones.find((e) => e.id === embrionId)
    if (emb?.padrillo_id && !padrilloPreId_) {
      setPadrilloId(emb.padrillo_id)
    }
  }, [embrionId, embriones, padrilloPreId_])

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
    if (!user?.id || !efectivaSociedadId) return

    setSaving(true)
    try {
      // 1. Crear registro clínico de la receptora con chip "Transferida"
      const registro = await crearRegistro(
        {
          caballo_id:         receptoraId,
          sociedad_id:        efectivaSociedadId,
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

      // 2. Crear la transferencia vinculada
      await crearTransferencia({
        sociedad_id:          efectivaSociedadId,
        fecha,
        veterinario_id:       user.id,
        registro_id:          registro.id,
        caballo_receptora_id: receptoraId,
        caballo_donante_id:   donanteId,
        padrillo_id:          padrilloId || null,
        flushing_id:          flushingId_ || null,
        embrion_id:           embrionId || null,
        cl_calidad:           clCalidad || null,
        tono_uterino:         tonoUterino || null,
        tono_cervical:        tonoCervical || null,
        clasificacion:        clasificacion || null,
        notas:                notas.trim() || null,
      })

      // 3. Marcar el embrión como transferido
      if (embrionId) {
        await crianzaService.marcarEmbrionTransferido(embrionId)
      }

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
      <div className="w-full max-w-md sm:mx-4 rounded-t-2xl sm:rounded-xl border border-slate-300 bg-white shadow-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <ArrowLeftRight size={15} className="text-blue-600" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Transferencia embrionaria</h2>
              {receptoraSelec && (
                <p className="text-xs text-slate-500 mt-0.5">{receptoraSelec.nombre}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
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
              <label className="text-xs font-medium text-slate-500">Receptora *</label>
              <select
                value={receptoraId}
                onChange={(e) => setReceptoraId(e.target.value)}
                disabled={cargando}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
              >
                <option value="">— Seleccioná —</option>
                {receptoras.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
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

          {/* Donante */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Donante *</label>
            <select
              value={donanteId}
              onChange={(e) => setDonanteId(e.target.value)}
              disabled={!!donantePredId_}
              className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60"
            >
              <option value="">— Seleccioná —</option>
              {donantes.map((d) => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
          </div>

          {/* Embrión disponible */}
          {donanteId && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">
                Embrión
                {embriones.length > 0 && (
                  <span className="ml-1 text-[10px] font-normal text-slate-400">
                    ({embriones.length} disponible{embriones.length !== 1 ? 's' : ''})
                  </span>
                )}
              </label>
              {embriones.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Sin embriones disponibles para esta donante.</p>
              ) : (
                <select
                  value={embrionId}
                  onChange={(e) => setEmbrionId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">— Sin especificar —</option>
                  {embriones.map((emb, i) => (
                    <option key={emb.id} value={emb.id}>
                      {labelEmbrion(emb, i)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Padrillo */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Padrillo</label>
            <select
              value={padrilloId}
              onChange={(e) => setPadrilloId(e.target.value)}
              disabled={!!padrilloPreId_}
              className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60"
            >
              <option value="">— Sin especificar —</option>
              {padrillos.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          {/* Ovarios de la receptora */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500">Estado ovárico de la receptora</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Ovario izquierdo</label>
                <input
                  type="text"
                  value={ovIzq}
                  onChange={(e) => setOvIzq(e.target.value)}
                  placeholder="CLV"
                  className="w-full rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Ovario derecho</label>
                <input
                  type="text"
                  value={ovDer}
                  onChange={(e) => setOvDer(e.target.value)}
                  placeholder="Chico"
                  className="w-full rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200" />

          {/* Condición reproductiva */}
          <p className="text-xs font-medium text-slate-500">Condición reproductiva</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400">Calidad CL</label>
              <select
                value={clCalidad}
                onChange={(e) => setClCalidad(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">—</option>
                {CL_CALIDADES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400">Tono uterino</label>
              <select
                value={tonoUterino}
                onChange={(e) => setTonoUterino(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">—</option>
                {TONOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400">Tono cervical</label>
              <select
                value={tonoCervical}
                onChange={(e) => setTonoCervical(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">—</option>
                {TONOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400">Clasificación embrión</label>
              <select
                value={clasificacion}
                onChange={(e) => setClasificacion(e.target.value as 'Fresco' | 'Congelado' | '')}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">—</option>
                <option value="Fresco">Fresco</option>
                <option value="Congelado">Congelado</option>
              </select>
            </div>
          </div>

          {/* Notas */}
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

          {/* Info: qué se va a crear */}
          <div className="rounded-md border border-slate-300 bg-slate-50 p-3 space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Se va a crear</p>
            <p className="text-xs text-slate-500">
              • Registro clínico de la receptora con chip <span className="text-violet-700">Transferida</span>
            </p>
            <p className="text-xs text-slate-500">
              • Registro de transferencia embrionaria
            </p>
            {embrionId && (
              <p className="text-xs text-slate-500">
                • El embrión seleccionado pasará a estado <span className="text-blue-600">Transferido</span>
              </p>
            )}
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
