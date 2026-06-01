import { useEffect, useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useCrianzaStore } from '../../store/crianzaStore'
import { crianzaService } from '../../services/crianzaService'
import { CHIPS_OI_OD, CHIPS_UTERO, CHIPS_OBS } from '../../types/crianza'
import type { RolReproductivo } from '../../types/crianza'
import { getCriaConfig } from '../../utils/criaConfig'
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
  sociedad_id?: string
  campo: { nombre: string } | null
}

const HOY = new Date().toISOString().split('T')[0]

export default function RegistroCriaModal({ onClose, onSuccess, caballoIdInicial }: Props) {
  const { user, sociedadActiva, rol } = useAuth()
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

  // Para vets sin sociedadActiva: se deriva del caballo seleccionado
  const [animalSociedadId, setAnimalSociedadId] = useState('')

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
    if (sociedadActiva) {
      crianzaService.listarAnimalesReproductivos(sociedadActiva.id).then((data) => {
        setAnimales(data.filter((a) => a.categoria !== 'Potrillo' && a.categoria !== 'Caballo'))
        setCargandoAnimales(false)
      })
    } else if (rol === 'veterinario') {
      crianzaService.listarAnimalesReproductivosVet().then((data) => {
        setAnimales(data.filter((a) => a.categoria !== 'Potrillo' && a.categoria !== 'Caballo'))
        setCargandoAnimales(false)
      })
    }
  }, [sociedadActiva, rol])

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
    const sociedadId = sociedadActiva?.id ?? animalSociedadId
    if (!sociedadId)      return setError('No se pudo determinar la sociedad del animal.')
    if (necesitaRol && !rolManual) return setError('Indicá si es Donante o Receptora.')

    setSaving(true)
    try {
      await crearRegistro(
        {
          caballo_id:         caballoId,
          sociedad_id:        sociedadId,
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
      <div className="w-full max-w-lg sm:mx-4 rounded-t-2xl sm:rounded-xl border border-slate-300 bg-white shadow-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Registro reproductivo</h2>
            {animalSeleccionado && (
              <p className="text-xs text-slate-500 mt-0.5">
                {animalSeleccionado.nombre}
                {rolEfectivo && (
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] border ${
                    rolEfectivo === 'Donante'
                      ? 'border-brand-300 text-brand-600'
                      : 'border-blue-300 text-blue-600'
                  }`}>
                    {rolEfectivo}
                  </span>
                )}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
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
              <label className="text-xs font-medium text-slate-500">Animal *</label>
              <select
                value={caballoId}
                onChange={(e) => {
                  const animal = animales.find((a) => a.id === e.target.value)
                  setCaballoId(e.target.value)
                  setAnimalSociedadId(animal?.sociedad_id ?? '')
                  setRolManual(null)
                }}
                disabled={cargandoAnimales}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
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
              <label className="text-xs font-medium text-slate-500">Fecha *</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Rol manual — solo si la yegua no tiene rol asignado */}
          {necesitaRol && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-brand-600">
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
                          ? 'border-brand-600 bg-brand-50 text-brand-700'
                          : 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-300 text-slate-500 hover:border-slate-400'
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
              <label className="text-xs font-medium text-slate-500">Días post-OV</label>
              <input
                type="number"
                min={0}
                max={30}
                value={ovDias}
                onChange={(e) => setOvDias(e.target.value)}
                placeholder="0"
                className="w-24 rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          )}

          {/* Útero */}
          <ChipSelector
            label="Útero"
            options={CHIPS_UTERO}
            selected={utero}
            onChange={setUtero}
            colorSelected="bg-blue-100 text-blue-700 border-blue-300"
          />

          {/* Observaciones / chips de acciones */}
          <ChipSelector
            label="Acciones / tratamientos"
            options={CHIPS_OBS}
            selected={obsChips}
            onChange={setObsChips}
            colorSelected="bg-violet-100 text-violet-700 border-violet-300"
          />

          {/* Padrillo — visible cuando se marcó IN */}
          {mostrarPadrillo && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Padrillo (inseminación)</label>
              <select
                value={padrilloId}
                onChange={(e) => setPadrilloId(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
                className="rounded border-slate-400 bg-slate-100 text-brand-500 focus:ring-brand-500"
              />
              <span className="text-xs text-slate-500">Revisión mañana</span>
            </label>
            {reviewManana && (
              <input
                type="text"
                value={reviewDesc}
                onChange={(e) => setReviewDesc(e.target.value)}
                placeholder="Motivo (opcional)"
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            )}
          </div>

          {/* Observaciones libres */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              placeholder="Notas adicionales…"
              className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
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
            form="registro-cria-form"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-md bg-brand-500 hover:bg-brand-400 text-white transition-colors disabled:opacity-50"
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
  const cfg = getCriaConfig()

  const tieneOV = ovarioIzq.includes('OV') || ovarioDer.includes('OV')

  if (rol === 'Donante') {
    if (obsChips.includes('Strelin')) items.push({ tipo: 'IN', fecha: sumarDias(fecha, cfg.donante_strelin_a_in) })
    if (obsChips.includes('IN'))      items.push({ tipo: 'OXI', fecha: sumarDias(fecha, cfg.donante_in_a_oxi) })
    if (tieneOV)                      items.push({ tipo: 'Flushing', fecha: sumarDias(fecha, cfg.donante_ov_a_flushing) })
    if (obsChips.includes('PG'))      items.push({ tipo: 'Revisión PG', fecha: sumarDias(fecha, cfg.donante_pg_a_revision_pg) })
    if (obsChips.includes('Flushing'))items.push({ tipo: 'Revisión Flushing', fecha: sumarDias(fecha, cfg.donante_flushing_a_revision) })
  }
  if (rol === 'Receptora') {
    if (obsChips.includes('Strelin')) items.push({ tipo: 'Revisión Strelin', fecha: proximoMWF(fecha) })
    if (obsChips.includes('PG'))      items.push({ tipo: 'Revisión PG', fecha: sumarDias(fecha, cfg.receptora_pg_a_revision_pg) })
    if (tieneOV && !obsChips.includes('Transferida'))
      items.push({ tipo: 'Dar PG', fecha: sumarDias(fecha, cfg.receptora_ov_a_dar_pg) })
  }
  if (reviewManana) items.push({ tipo: 'Revisión', fecha: proximoMWF(fecha) })

  if (items.length === 0) return null

  return (
    <div className="rounded-md border border-slate-300 bg-slate-50 p-3 space-y-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
        Recordatorios a generar
      </p>
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between text-xs">
          <span className="text-slate-600">{item.tipo}</span>
          <span className="text-slate-400">{formatFecha(item.fecha)}</span>
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
