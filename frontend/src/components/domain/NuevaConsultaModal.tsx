import { useEffect, useRef, useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { caballoService } from '../../services/caballoService'
import { catalogoService } from '../../services/catalogoService'
import { historialService } from '../../services/historialService'
import { useAuthStore } from '../../store/authStore'
import Spinner from '../ui/Spinner'
import type { HistorialEntry } from './HistorialCard'

interface Props {
  /** Si se pasa, el caballo está pre-seleccionado y no se muestra el selector */
  caballoId?: string
  /** Si se pasa, el modal opera en modo edición */
  entryToEdit?: HistorialEntry
  onClose: () => void
  onSuccess: () => void
}

interface ParteRow { tempId: string; parteCuerpoId: string; lado: string; descripcion: string }
interface MedRow   { tempId: string; medicamento: string; dosis: string; via: string; duracion: string }

const LADOS = ['izquierdo', 'derecho', 'bilateral', 'no aplica']

let _id = 0
const uid = () => String(++_id)

export default function NuevaConsultaModal({ caballoId, entryToEdit, onClose, onSuccess }: Props) {
  const user    = useAuthStore((s) => s.user)
  const sociedad = useAuthStore((s) => s.sociedadActiva)

  // Catálogos
  const [caballos,   setCaballos]   = useState<{ id: string; nombre: string }[]>([])
  const [tipos,      setTipos]      = useState<{ id: number; nombre: string }[]>([])
  const [partesCat,  setPartesCat]  = useState<{ id: number; nombre: string }[]>([])
  const [loadingCat, setLoadingCat] = useState(true)

  // Campos del formulario
  const [selCaballoId,    setSelCaballoId]    = useState(caballoId ?? '')
  const [tipoConsultaId,  setTipoConsultaId]  = useState('')
  const [fechaConsulta,   setFechaConsulta]   = useState(() => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)   // formato datetime-local
  })
  const [diagnostico,     setDiagnostico]     = useState('')
  const [tratamiento,     setTratamiento]     = useState('')
  const [observaciones,   setObservaciones]   = useState('')
  const [proximaCons,     setProximaCons]     = useState('')

  // Partes afectadas (lista dinámica)
  const [partes, setPartes] = useState<ParteRow[]>([])
  const addParte  = () => setPartes((p) => [...p, { tempId: uid(), parteCuerpoId: '', lado: 'no aplica', descripcion: '' }])
  const remParte  = (id: string) => setPartes((p) => p.filter((r) => r.tempId !== id))
  const updParte  = (id: string, key: keyof ParteRow, val: string) =>
    setPartes((p) => p.map((r) => r.tempId === id ? { ...r, [key]: val } : r))

  // Medicamentos (lista dinámica)
  const [meds, setMeds] = useState<MedRow[]>([])
  const addMed  = () => setMeds((m) => [...m, { tempId: uid(), medicamento: '', dosis: '', via: '', duracion: '' }])
  const remMed  = (id: string) => setMeds((m) => m.filter((r) => r.tempId !== id))
  const updMed  = (id: string, key: keyof MedRow, val: string) =>
    setMeds((m) => m.map((r) => r.tempId === id ? { ...r, [key]: val } : r))

  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // Cerrar con Escape
  const overlayRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Cargar catálogos y pre-rellenar si es edición
  useEffect(() => {
    Promise.all([
      caballoId ? Promise.resolve([]) : caballoService.listar(sociedad?.id ?? ''),
      catalogoService.tiposConsulta(),
      catalogoService.partesCuerpo(),
    ]).then(([cabs, tip, par]) => {
      const tipArr = tip as { id: number; nombre: string }[]
      const parArr = par as { id: number; nombre: string }[]
      setCaballos(cabs as { id: string; nombre: string }[])
      setTipos(tipArr)
      setPartesCat(parArr)

      if (entryToEdit) {
        const tipoFound = tipArr.find((t) =>
          entryToEdit.cat_tipo_consulta.id != null
            ? t.id === entryToEdit.cat_tipo_consulta.id
            : t.nombre === entryToEdit.cat_tipo_consulta.nombre
        )
        if (tipoFound) setTipoConsultaId(String(tipoFound.id))

        const d = new Date(entryToEdit.fecha_consulta)
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
        setFechaConsulta(d.toISOString().slice(0, 16))

        setDiagnostico(entryToEdit.diagnostico ?? '')
        setTratamiento(entryToEdit.tratamiento ?? '')
        setObservaciones(entryToEdit.observaciones ?? '')
        setProximaCons(entryToEdit.proxima_consulta ?? '')

        setPartes(entryToEdit.historial_parte_afectada.map((p) => {
          const found = parArr.find((pc) => pc.nombre === p.cat_parte_cuerpo.nombre)
          return {
            tempId: uid(),
            parteCuerpoId: found ? String(found.id) : '',
            lado: p.lado ?? 'no aplica',
            descripcion: p.descripcion ?? '',
          }
        }))

        setMeds(entryToEdit.historial_medicamento.map((m) => ({
          tempId: uid(),
          medicamento: m.medicamento,
          dosis: m.dosis ?? '',
          via: m.via_administracion ?? '',
          duracion: m.duracion_dias != null ? String(m.duracion_dias) : '',
        })))
      }
    }).finally(() => setLoadingCat(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caballoId, sociedad?.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selCaballoId || !tipoConsultaId || !fechaConsulta) {
      setError('Caballo, tipo de consulta y fecha son obligatorios.')
      return
    }
    if (!user?.id) { setError('Sin sesión de usuario.'); return }

    setSubmitting(true)
    setError(null)
    try {
      const partesAfectadas = partes
        .filter((p) => p.parteCuerpoId)
        .map((p) => ({
          parteCuerpoId: Number(p.parteCuerpoId),
          lado: p.lado,
          descripcion: p.descripcion || undefined,
        }))
      const medicamentos = meds
        .filter((m) => m.medicamento.trim())
        .map((m) => ({
          medicamento:       m.medicamento,
          dosis:             m.dosis    || undefined,
          viaAdministracion: m.via      || undefined,
          duracionDias:      m.duracion ? Number(m.duracion) : undefined,
        }))

      if (entryToEdit) {
        await historialService.actualizar(entryToEdit.id, selCaballoId, {
          tipoConsultaId:  Number(tipoConsultaId),
          fechaConsulta:   new Date(fechaConsulta).toISOString(),
          diagnostico:     diagnostico   || undefined,
          tratamiento:     tratamiento   || undefined,
          observaciones:   observaciones || undefined,
          proximaConsulta: proximaCons   || undefined,
          partesAfectadas,
          medicamentos,
        })
      } else {
        await historialService.crear({
          caballoId:       selCaballoId,
          tipoConsultaId:  Number(tipoConsultaId),
          fechaConsulta:   new Date(fechaConsulta).toISOString(),
          diagnostico:     diagnostico   || undefined,
          tratamiento:     tratamiento   || undefined,
          observaciones:   observaciones || undefined,
          proximaConsulta: proximaCons   || undefined,
          creadoPor:       user.id,
          partesAfectadas,
          medicamentos,
        })
      }
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4 shrink-0">
          <h2 className="text-base font-semibold text-zinc-100">
            {entryToEdit ? 'Editar consulta clínica' : 'Nueva consulta clínica'}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo — scrollable */}
        <form
          id="nueva-consulta-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-5"
        >
          {loadingCat ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : (
            <>
              {/* Selector de caballo (solo si no viene pre-seleccionado) */}
              {!caballoId && (
                <Field label="Caballo *">
                  <select
                    value={selCaballoId}
                    onChange={(e) => setSelCaballoId(e.target.value)}
                    required
                    className={selectClass}
                  >
                    <option value="">— Seleccionar caballo —</option>
                    {caballos.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </Field>
              )}

              {/* Tipo de consulta + Fecha */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Tipo de consulta *">
                  <select
                    value={tipoConsultaId}
                    onChange={(e) => setTipoConsultaId(e.target.value)}
                    required
                    className={selectClass}
                  >
                    <option value="">— Seleccionar —</option>
                    {tipos.map((t) => (
                      <option key={t.id} value={t.id}>{t.nombre}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Fecha y hora *">
                  <input
                    type="datetime-local"
                    value={fechaConsulta}
                    onChange={(e) => setFechaConsulta(e.target.value)}
                    required
                    className={inputClass}
                  />
                </Field>
              </div>

              {/* Diagnóstico */}
              <Field label="Diagnóstico">
                <textarea
                  value={diagnostico}
                  onChange={(e) => setDiagnostico(e.target.value)}
                  rows={2}
                  placeholder="Descripción del diagnóstico…"
                  className={textareaClass}
                />
              </Field>

              {/* Tratamiento */}
              <Field label="Tratamiento">
                <textarea
                  value={tratamiento}
                  onChange={(e) => setTratamiento(e.target.value)}
                  rows={2}
                  placeholder="Plan de tratamiento indicado…"
                  className={textareaClass}
                />
              </Field>

              {/* Observaciones + Próxima consulta */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Observaciones">
                  <textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    rows={2}
                    placeholder="Notas adicionales…"
                    className={textareaClass}
                  />
                </Field>
                <Field label="Próxima consulta">
                  <input
                    type="date"
                    value={proximaCons}
                    onChange={(e) => setProximaCons(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>

              {/* ── Partes afectadas ── */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                    Partes afectadas
                  </h3>
                  <button type="button" onClick={addParte} className={addRowBtn}>
                    <Plus size={12} /> Agregar
                  </button>
                </div>

                {partes.length === 0 && (
                  <p className="text-xs text-zinc-600 italic">Sin partes afectadas registradas.</p>
                )}

                <div className="space-y-2">
                  {partes.map((row) => (
                    <div key={row.tempId} className="flex gap-2 items-start">
                      <select
                        value={row.parteCuerpoId}
                        onChange={(e) => updParte(row.tempId, 'parteCuerpoId', e.target.value)}
                        className={`${selectClass} flex-1`}
                      >
                        <option value="">— Parte del cuerpo —</option>
                        {partesCat.map((p) => (
                          <option key={p.id} value={p.id}>{p.nombre}</option>
                        ))}
                      </select>
                      <select
                        value={row.lado}
                        onChange={(e) => updParte(row.tempId, 'lado', e.target.value)}
                        className={`${selectClass} w-32`}
                      >
                        {LADOS.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                      <input
                        type="text"
                        value={row.descripcion}
                        onChange={(e) => updParte(row.tempId, 'descripcion', e.target.value)}
                        placeholder="Descripción"
                        className={`${inputClass} flex-1`}
                      />
                      <button
                        type="button"
                        onClick={() => remParte(row.tempId)}
                        className="mt-0.5 text-zinc-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── Medicamentos ── */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                    Medicamentos
                  </h3>
                  <button type="button" onClick={addMed} className={addRowBtn}>
                    <Plus size={12} /> Agregar
                  </button>
                </div>

                {meds.length === 0 && (
                  <p className="text-xs text-zinc-600 italic">Sin medicamentos registrados.</p>
                )}

                <div className="space-y-2">
                  {meds.map((row) => (
                    <div key={row.tempId} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-start">
                      <input
                        type="text"
                        value={row.medicamento}
                        onChange={(e) => updMed(row.tempId, 'medicamento', e.target.value)}
                        placeholder="Medicamento *"
                        className={inputClass}
                      />
                      <input
                        type="text"
                        value={row.dosis}
                        onChange={(e) => updMed(row.tempId, 'dosis', e.target.value)}
                        placeholder="Dosis"
                        className={inputClass}
                      />
                      <input
                        type="text"
                        value={row.via}
                        onChange={(e) => updMed(row.tempId, 'via', e.target.value)}
                        placeholder="Vía"
                        className={inputClass}
                      />
                      <input
                        type="number"
                        value={row.duracion}
                        onChange={(e) => updMed(row.tempId, 'duracion', e.target.value)}
                        placeholder="Días"
                        min={1}
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() => remMed(row.tempId)}
                        className="mt-0.5 text-zinc-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {error && (
                <p className="rounded-lg bg-red-950 border border-red-900 px-3 py-2 text-xs text-red-300">
                  {error}
                </p>
              )}
            </>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-zinc-800 px-5 py-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="nueva-consulta-form"
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            {submitting && <Spinner size="sm" />}
            {entryToEdit ? 'Guardar cambios' : 'Guardar consulta'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers de estilo ──────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-zinc-400">{label}</label>
      {children}
    </div>
  )
}

const base = 'rounded-lg border border-zinc-700 bg-zinc-800 text-sm text-zinc-200 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none px-3 py-2 w-full'
const inputClass    = base
const selectClass   = base
const textareaClass = `${base} resize-none`
const addRowBtn     = 'flex items-center gap-1 text-xs text-zinc-500 hover:text-emerald-400 transition-colors'
