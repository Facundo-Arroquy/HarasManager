import { useEffect, useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useCrianzaStore } from '../../store/crianzaStore'
import { crianzaService } from '../../services/crianzaService'
import { CHIPS_OI_OD, CHIPS_UTERO, CHIPS_OBS } from '../../types/crianza'
import type { RolReproductivo } from '../../types/crianza'
import ChipSelector from './ChipSelector'

interface Props {
  onClose: () => void
  onSuccess?: () => void
  // Pre-seleccionar un animal (desde ProgramaSemanal o vista de detalle)
  caballoIdInicial?: string
}

type AnimalItem = {
  id: string
  nombre: string
  categoria: string
  rol_reproductivo: RolReproductivo
  campo: { nombre: string } | null
}

const HOY = new Date().toISOString().split('T')[0]

export default function RegistroCriaModal({ onClose, onSuccess, caballoIdInicial }: Props) {
  const { user, sociedadActiva } = useAuth()
  const { crearRegistro } = useCrianzaStore()

  const [animales, setAnimales] = useState<AnimalItem[]>([])
  const [cargandoAnimales, setCargandoAnimales] = useState(true)

  // ── Form state ────────────────────────────────────────────────────────────
  const [caballoId,     setCaballoId]     = useState(caballoIdInicial ?? '')
  const [fecha,         setFecha]         = useState(HOY)
  const [ovarioIzq,     setOvarioIzq]     = useState<string[]>([])
  const [ovarioDer,     setOvarioDer]     = useState<string[]>([])
  const [utero,         setUtero]         = useState<string[]>([])
  const [obsChips,      setObsChips]      = useState<string[]>([])
  const [padrilloId,    setPadrilloId]    = useState('')
  const [ovDias,        setOvDias]        = useState<string>('')
  const [reviewManana,  setReviewManana]  = useState(false)
  const [reviewDesc,    setReviewDesc]    = useState('')
  const [observaciones, setObservaciones] = useState('')
  // Si el animal no tiene rol asignado, el vet elige uno en el modal
  const [rolManual,     setRolManual]     = useState<RolReproductivo>(null)

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  // ── Derivados ─────────────────────────────────────────────────────────────
  const animalSeleccionado = animales.find((a) => a.id === caballoId) ?? null
  const padrillos          = animales.filter((a) => a.categoria === 'Padrillo')
  const rolEfectivo: RolReproductivo =
    animalSeleccionado?.rol_reproductivo ?? rolManual

  const mostrarPadrillo = obsChips.includes('IN')
  const mostrarOvDias   = ovarioIzq.includes('OV') || ovarioDer.includes('OV')
  const necesitaRol     = animalSeleccionado && !animalSeleccionado.rol_reproductivo

  // ── Carga de animales ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!sociedadActiva) return
    crianzaService.listarAnimalesReproductivos(sociedadActiva.id).then((data) => {
      // Mostrar yeguas y padrillos (no potrillos)
      setAnimales(data.filter((a) => a.categoria !== 'Potrillo' && a.categoria !== 'Caballo'))
      setCargandoAnimales(false)
    })
  }, [sociedadActiva])

  // Escape para cerrar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!caballoId)       return setError('Seleccioná un animal.')
    if (!fecha)           return setError('La fecha es requerida.')
    if (!user?.id)        return setError('Sin sesión activa.')
    if (!sociedadActiva)  return
    if (necesitaRol && !rolManual) return setError('Indicá si es Donante o Receptora.')

    setSaving(true)
    try {
      await crearRegistro(
        {
          caballo_id:         caballoId,
          sociedad_id:        sociedadActiva.id,
          fecha,
          veterinario_id:     user.id,
          ovario_izq:         ovarioIzq,
          ovario_der:         ovarioDer,
          utero,
          obs_chips:          obsChips,
          padrillo_id:        mostrarPadrillo && padrilloId ? padrilloId : null,
          ov_dias:            mostrarOvDias && ovDias !== '' ? Number(ovDias) : null,
          review_manana:      reviewManana,
          review_manana_desc: reviewManana && reviewDesc ? reviewDesc : null,
          motivo:             null,
          diagnostico:        null,
          tratamiento:        null,
          observaciones:      observaciones.trim() || null,
        },
        rolEfectivo
      )

      // Si el animal no tenía rol, persistirlo
      if (necesitaRol && rolManual) {
        await crianzaService.actualizarRolReproductivo(caballoId, rolManual)
      }

      onSuccess?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar.')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg sm:mx-4 rounded-t-2xl sm:rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Registro reproductivo</h2>
            {animalSeleccionado && (
              <p className="text-xs text-zinc-400 mt-0.5">
                {animalSeleccionado.nombre}
                {rolEfectivo && (
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] border ${
                    rolEfectivo === 'Donante'
                      ? 'border-amber-700 text-amber-400'
                      : 'border-blue-700 text-blue-400'
                  }`}>
                    {rolEfectivo}
                  </span>
                )}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form
          id="registro-cria-form"
          onSubmit={handleSubmit}
          className="overflow-y-auto flex-1 px-5 py-4 space-y-5"
        >
          {/* Animal + Fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-xs font-medium text-zinc-400">Animal *</label>
              <select
                value={caballoId}
                onChange={(e) => {
                  setCaballoId(e.target.value)
                  setRolManual(null)
                }}
                disabled={cargandoAnimales}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
              >
                <option value="">— Seleccioná —</option>
                {animales.filter((a) => a.categoria !== 'Padrillo').map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                    {a.rol_reproductivo ? ` (${a.rol_reproductivo})` : ''}
                  </option>
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

          {/* Rol manual — solo si la yegua no tiene rol asignado */}
          {necesitaRol && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-amber-400">
                Esta yegua no tiene rol reproductivo asignado. ¿Es...?
              </label>
              <div className="flex gap-2">
                {(['Donante', 'Receptora'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRolManual(r)}
                    className={`flex-1 py-2 rounded-md border text-sm transition-colors ${
                      rolManual === r
                        ? r === 'Donante'
                          ? 'border-amber-600 bg-amber-900/30 text-amber-300'
                          : 'border-blue-600 bg-blue-900/30 text-blue-300'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ovarios */}
          <div className="grid grid-cols-2 gap-4">
            <ChipSelector
              label="Ovario izquierdo"
              options={CHIPS_OI_OD}
              selected={ovarioIzq}
              onChange={setOvarioIzq}
            />
            <ChipSelector
              label="Ovario derecho"
              options={CHIPS_OI_OD}
              selected={ovarioDer}
              onChange={setOvarioDer}
            />
          </div>

          {/* Días post-OV — visible cuando se marcó OV */}
          {mostrarOvDias && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Días post-OV</label>
              <input
                type="number"
                min={0}
                max={30}
                value={ovDias}
                onChange={(e) => setOvDias(e.target.value)}
                placeholder="0"
                className="w-24 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          )}

          {/* Útero */}
          <ChipSelector
            label="Útero"
            options={CHIPS_UTERO}
            selected={utero}
            onChange={setUtero}
            colorSelected="bg-blue-900/40 text-blue-300 border-blue-700"
          />

          {/* Observaciones / chips de acciones */}
          <ChipSelector
            label="Acciones / tratamientos"
            options={CHIPS_OBS}
            selected={obsChips}
            onChange={setObsChips}
            colorSelected="bg-violet-900/40 text-violet-300 border-violet-700"
          />

          {/* Padrillo — visible cuando se marcó IN */}
          {mostrarPadrillo && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Padrillo (inseminación)</label>
              <select
                value={padrilloId}
                onChange={(e) => setPadrilloId(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">— Seleccioná padrillo —</option>
                {padrillos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
          )}

          {/* Revisión mañana */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={reviewManana}
                onChange={(e) => setReviewManana(e.target.checked)}
                className="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-xs text-zinc-400">Revisión mañana</span>
            </label>
            {reviewManana && (
              <input
                type="text"
                value={reviewDesc}
                onChange={(e) => setReviewDesc(e.target.value)}
                placeholder="Motivo (opcional)"
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            )}
          </div>

          {/* Observaciones libres */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              placeholder="Notas adicionales…"
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Previsualización de recordatorios a generar */}
          {caballoId && obsChips.length > 0 && (
            <RecordatoriosPreview
              obsChips={obsChips}
              ovarioDer={ovarioDer}
              ovarioIzq={ovarioIzq}
              fecha={fecha}
              rol={rolEfectivo}
              reviewManana={reviewManana}
            />
          )}

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
            form="registro-cria-form"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar registro'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Preview de recordatorios automáticos ──────────────────────────────────────

function RecordatoriosPreview({
  obsChips, ovarioIzq, ovarioDer, fecha, rol, reviewManana,
}: {
  obsChips: string[]
  ovarioIzq: string[]
  ovarioDer: string[]
  fecha: string
  rol: RolReproductivo
  reviewManana: boolean
}) {
  const items: { tipo: string; fecha: string }[] = []

  const tieneOV = ovarioIzq.includes('OV') || ovarioDer.includes('OV')

  if (rol === 'Donante') {
    if (obsChips.includes('Strelin')) items.push({ tipo: 'IN', fecha: sumarDias(fecha, 1) })
    if (obsChips.includes('IN'))      items.push({ tipo: 'OXI', fecha: sumarDias(fecha, 1) })
    if (tieneOV)                      items.push({ tipo: 'Flushing', fecha: sumarDias(fecha, 6) })
    if (obsChips.includes('PG'))      items.push({ tipo: 'Revisión PG', fecha: sumarDias(fecha, 3) })
    if (obsChips.includes('Flushing'))items.push({ tipo: 'Revisión Flushing', fecha: sumarDias(fecha, 4) })
  }
  if (rol === 'Receptora') {
    if (obsChips.includes('Strelin')) items.push({ tipo: 'Revisión Strelin', fecha: proximoMWF(fecha) })
    if (obsChips.includes('PG'))      items.push({ tipo: 'Revisión PG', fecha: sumarDias(fecha, 4) })
    if (tieneOV && !obsChips.includes('Transferida'))
      items.push({ tipo: 'Dar PG', fecha: sumarDias(fecha, 3) })
  }
  if (reviewManana) items.push({ tipo: 'Revisión', fecha: proximoMWF(fecha) })

  if (items.length === 0) return null

  return (
    <div className="rounded-md border border-zinc-700 bg-zinc-800/50 p-3 space-y-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        Recordatorios a generar
      </p>
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between text-xs">
          <span className="text-zinc-300">{item.tipo}</span>
          <span className="text-zinc-500">{formatFecha(item.fecha)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Utilidades ───────────────────────────────────────────────────────────────

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(fecha + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().split('T')[0]
}

function proximoMWF(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  while (![1, 3, 5].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().split('T')[0]
}

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y.slice(2)}`
}
