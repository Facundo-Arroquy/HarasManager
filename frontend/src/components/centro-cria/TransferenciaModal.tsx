import { useEffect, useMemo, useState } from 'react'
import { X, AlertCircle, ArrowLeftRight, CheckCircle2, AlertTriangle } from 'lucide-react'
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

function formatFecha(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y.slice(2)}`
}

function labelEmbrion(e: Embrion, idx: number): string {
  const partes: string[] = [`#${idx + 1}`]
  if (e.estado === 'congelado') partes.push('Vitrificado')
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
  const { registrarTransferencia, transferencias } = useCrianzaStore()

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
  const [exito,  setExito]  = useState(false)
  // La receptora no se bloquea: se avisa que ya recibió una transferencia y se
  // pide una confirmación explícita antes de guardar.
  const [confirmadoRepetida, setConfirmadoRepetida] = useState(false)

  const receptoras = animales.filter((a) => a.rol_reproductivo === 'Receptora')
  const donantes   = animales.filter((a) => a.rol_reproductivo === 'Donante')
  const padrillos  = animales.filter((a) => a.categoria === 'Padrillo')

  // Última transferencia registrada por receptora, para avisar reutilización
  const ultimaTransfPorReceptora = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const t of transferencias) {
      const previa = mapa.get(t.caballo_receptora_id)
      if (!previa || t.fecha > previa) mapa.set(t.caballo_receptora_id, t.fecha)
    }
    return mapa
  }, [transferencias])

  const ultimaTransfReceptora = receptoraId ? ultimaTransfPorReceptora.get(receptoraId) : undefined

  // Los embriones salen del flushing: sin stock disponible no hay transferencia posible
  const sinEmbriones = !!donanteId && embriones.length === 0

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
    if (!user?.id)     return setError('No se pudo identificar al usuario. Volvé a iniciar sesión.')
    if (!efectivaSociedadId) return setError('No se pudo determinar la sociedad. Cerrá el modal y volvé a intentar.')

    // El embrión sale del flushing y es obligatorio: sin él la transferencia
    // quedaría sin stock que descontar y el embrión seguiría figurando disponible.
    if (sinEmbriones) {
      return setError('La donante no tiene embriones disponibles. Registrá el flushing con la cantidad recuperada antes de transferir.')
    }
    if (!embrionId) return setError('Seleccioná el embrión a transferir.')

    if (ultimaTransfReceptora && !confirmadoRepetida) {
      setConfirmadoRepetida(true)
      return setError(`Esta receptora ya recibió una transferencia el ${formatFecha(ultimaTransfReceptora)}. Volvé a presionar para confirmar.`)
    }

    setSaving(true)
    try {
      // Registro clínico + transferencia + embrión descontado, en una sola
      // transacción. Si algo falla no queda nada a medias.
      await registrarTransferencia({
        sociedad_id:          efectivaSociedadId,
        fecha,
        caballo_receptora_id: receptoraId,
        caballo_donante_id:   donanteId,
        embrion_id:           embrionId,
        padrillo_id:          padrilloId || null,
        flushing_id:          flushingId_ || null,
        ovario_izq:           ovIzq ? [ovIzq] : [],
        ovario_der:           ovDer ? [ovDer] : [],
        cl_calidad:           clCalidad || null,
        tono_uterino:         tonoUterino || null,
        tono_cervical:        tonoCervical || null,
        clasificacion:        clasificacion || null,
        notas:                notas.trim() || null,
      })

      setExito(true)
      setTimeout(() => {
        onSuccess?.()
        onClose()
      }, 1200)
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
                onChange={(e) => {
                  setReceptoraId(e.target.value)
                  setConfirmadoRepetida(false)
                  setError('')
                }}
                disabled={cargando}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
              >
                <option value="">— Seleccioná —</option>
                {receptoras.map((r) => {
                  const ultima = ultimaTransfPorReceptora.get(r.id)
                  return (
                    <option key={r.id} value={r.id}>
                      {ultima ? `${r.nombre} · Transferida ${formatFecha(ultima)}` : r.nombre}
                    </option>
                  )
                })}
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

          {/* Aviso: receptora ya usada */}
          {ultimaTransfReceptora && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
              <AlertTriangle size={13} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800">
                Esta receptora ya recibió una transferencia el{' '}
                <span className="font-medium">{formatFecha(ultimaTransfReceptora)}</span>.
                Verificá que esté vacía antes de volver a transferirle.
              </p>
            </div>
          )}

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
                Embrión *
                {embriones.length > 0 && (
                  <span className="ml-1 text-[10px] font-normal text-slate-400">
                    ({embriones.length} disponible{embriones.length !== 1 ? 's' : ''})
                  </span>
                )}
              </label>
              {sinEmbriones ? (
                <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2">
                  <AlertCircle size={13} className="text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-700">
                    Esta donante no tiene embriones disponibles. Los embriones se generan al registrar
                    el flushing con la cantidad recuperada — cargalo antes de transferir.
                  </p>
                </div>
              ) : (
                <select
                  value={embrionId}
                  onChange={(e) => {
                    setEmbrionId(e.target.value)
                    const emb = embriones.find((x) => x.id === e.target.value)
                    if (emb) setClasificacion(emb.estado === 'congelado' ? 'Congelado' : 'Fresco')
                  }}
                  className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">— Seleccioná —</option>
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
                <option value="Congelado">Vitrificado</option>
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
            <div className="flex items-start gap-2 text-xs text-red-600">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {exito && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              <p className="text-xs text-emerald-800">
                Transferencia registrada. El embrión pasó a <span className="font-medium">Transferido</span>.
              </p>
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
            disabled={saving || exito || sinEmbriones}
            className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando…'
              : exito ? 'Registrada ✓'
              : confirmadoRepetida ? 'Confirmar transferencia'
              : 'Registrar transferencia'}
          </button>
        </div>
      </div>
    </div>
  )
}
