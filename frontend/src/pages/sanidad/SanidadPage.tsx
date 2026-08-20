import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Syringe, Check, X, CheckCircle2, CalendarDays, Stethoscope, Share2, Pencil, Trash2 } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { sanidadService } from '../../services/sanidadService'
import { getVeterinariosPlataforma, type VeterinarioPlataforma } from '../../services/adminService'
import { nombreCaballo } from '../../utils/caballo'
import { mensajeError } from '../../utils/error'
import {
  LABEL_ESTADO_TRABAJO,
  type CaballoSinAcceso,
  type TrabajoSanitario,
} from '../../types/sanidad'
import { agruparPorPlan, type GrupoPlan } from '../../utils/planSanitario'
import NuevoTrabajoSanitarioModal from '../../components/domain/NuevoTrabajoSanitarioModal'
import EditarTrabajoSanitarioModal from '../../components/domain/EditarTrabajoSanitarioModal'
import NuevaConsultaModal from '../../components/domain/NuevaConsultaModal'
import ConfirmarAccesoVetModal from '../../components/domain/ConfirmarAccesoVetModal'
import Spinner from '../../components/ui/Spinner'

const ESTADO_BADGE: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  realizado: 'bg-emerald-100 text-emerald-700',
  cancelado: 'bg-slate-100 text-slate-500',
}

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

export default function SanidadPage() {
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const userId     = useAuthStore((s) => s.user?.id)
  const rol        = useAuthStore((s) => s.rol)
  const esVet      = rol === 'veterinario'
  const esAdmin    = rol === 'admin' || rol === 'superadmin'
  // El admin también carga consultas y tratamientos sobre los caballos de su empresa.
  const puedeCargarConsulta = esVet || rol === 'admin'

  const [trabajos, setTrabajos] = useState<TrabajoSanitario[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [showNuevo, setShowNuevo] = useState(false)
  const [showConsulta, setShowConsulta] = useState(false)
  const [completar, setCompletar] = useState<GrupoPlan | null>(null)
  const [compartir, setCompartir] = useState<TrabajoSanitario | null>(null)
  const [editar,    setEditar]    = useState<TrabajoSanitario | null>(null)
  const [vets,      setVets]      = useState<VeterinarioPlataforma[]>([])

  useEffect(() => {
    if (esVet) return
    getVeterinariosPlataforma().then(setVets).catch(() => setVets([]))
  }, [esVet])

  const nombreVet = useCallback((id: string | null) => {
    if (!id) return null
    const v = vets.find((x) => x.id === id)
    return v ? `${v.nombre} ${v.apellido}` : 'un veterinario'
  }, [vets])

  const cargar = useCallback(async () => {
    if (!esVet && !sociedadId) return
    setLoading(true)
    setError(null)
    try {
      setTrabajos(esVet
        ? await sanidadService.listarTrabajosVet()
        : await sanidadService.listarTrabajos(sociedadId!))
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setLoading(false)
    }
  }, [sociedadId, esVet])

  useEffect(() => { cargar() }, [cargar])

  // Se lista el plan del día, no cada trabajo suelto: tres vacunas cargadas
  // juntas para el mismo grupo de caballos son una sola salida al campo.
  const pendientes = useMemo(
    () => agruparPorPlan(trabajos.filter((t) => t.estado === 'pendiente')),
    [trabajos],
  )
  const historial = useMemo(
    () => agruparPorPlan(trabajos.filter((t) => t.estado !== 'pendiente')),
    [trabajos],
  )

  /**
   * Corregir un trabajo que todavía no se hizo lo puede el autor, la empresa
   * dueña y el vet al que se le asignó. Borrarlo, solo los tres primeros: es lo
   * que deja pasar la RLS.
   */
  const puedeEditar = useCallback((t: TrabajoSanitario) =>
    t.creado_por === userId || esAdmin || t.vet_owner_id === userId || t.compartido_con === userId,
  [userId, esAdmin])

  const puedeEliminar = useCallback((t: TrabajoSanitario) =>
    t.creado_por === userId || esAdmin || t.vet_owner_id === userId,
  [userId, esAdmin])

  const eliminarTrabajo = useCallback(async (t: TrabajoSanitario) => {
    const cuantos = t.caballos?.length ?? 0
    const ok = window.confirm(
      `¿Eliminar el trabajo “${t.nombre}” del ${formatFecha(t.fecha_programada)}?\n\n` +
      `Se borra para los ${cuantos} caballo${cuantos !== 1 ? 's' : ''} del trabajo. No se puede deshacer.`,
    )
    if (!ok) return
    try {
      await sanidadService.eliminarTrabajos([t.id])
      await cargar()
    } catch (e) {
      setError(mensajeError(e, 'No se pudo eliminar el trabajo.'))
    }
  }, [cargar])

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Sanidad</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Trabajos sanitarios (vacunas, desparasitaciones, etc.)
          </p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {puedeCargarConsulta && (
            <button
              onClick={() => setShowConsulta(true)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                esVet
                  ? 'bg-brand-500 hover:bg-brand-400 text-white'
                  : 'border border-slate-300 hover:border-slate-400 text-slate-700'
              }`}
            >
              <Plus size={15} />
              <span className="sm:hidden">Consulta</span>
              <span className="hidden sm:inline">Nueva consulta</span>
            </button>
          )}
          <button
            onClick={() => setShowNuevo(true)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              esVet
                ? 'border border-slate-300 hover:border-slate-400 text-slate-700'
                : 'bg-brand-500 hover:bg-brand-400 text-white'
            }`}
          >
            <Plus size={15} />
            <span className="sm:hidden">Plan</span>
            <span className="hidden sm:inline">Nuevo plan sanitario</span>
          </button>
        </div>
      </div>

      {loading && <div className="flex justify-center py-20"><Spinner size="lg" /></div>}
      {error   && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">Error: {error}</div>}

      {!loading && !error && trabajos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-sm">
          <Syringe size={28} className="mb-2 opacity-30" />
          Sin trabajos sanitarios. Creá el primero con “Nuevo plan sanitario”.
        </div>
      )}

      {!loading && !error && trabajos.length > 0 && (
        <div className="space-y-6">
          {pendientes.length > 0 && (
            <Seccion titulo="Pendientes">
              {pendientes.map((g) => (
                <PlanRow
                  key={g.clave}
                  grupo={g}
                  vetNombre={nombreVet(g.trabajos[0].compartido_con)}
                  onCompletar={() => setCompletar(g)}
                  onCompartir={esVet ? undefined : () => setCompartir(g.trabajos[0])}
                  onEditar={puedeEditar(g.trabajos[0]) ? (t) => setEditar(t) : undefined}
                  onEliminar={puedeEliminar(g.trabajos[0]) ? eliminarTrabajo : undefined}
                />
              ))}
            </Seccion>
          )}
          {historial.length > 0 && (
            <Seccion titulo="Realizados / cancelados">
              {historial.map((g) => (
                <PlanRow key={g.clave} grupo={g} vetNombre={nombreVet(g.trabajos[0].compartido_con)} />
              ))}
            </Seccion>
          )}
        </div>
      )}

      {showNuevo && (
        <NuevoTrabajoSanitarioModal
          onClose={() => setShowNuevo(false)}
          onSuccess={() => { setShowNuevo(false); cargar() }}
        />
      )}
      {showConsulta && (
        <NuevaConsultaModal
          onClose={() => setShowConsulta(false)}
          onSuccess={() => setShowConsulta(false)}
        />
      )}
      {compartir && (
        <CompartirModal
          trabajo={compartir}
          trabajos={trabajos}
          vets={vets}
          onClose={() => setCompartir(null)}
          onSuccess={() => { setCompartir(null); cargar() }}
        />
      )}
      {editar && (
        <EditarTrabajoSanitarioModal
          trabajo={editar}
          onEliminar={puedeEliminar(editar)
            ? () => { const t = editar; setEditar(null); eliminarTrabajo(t) }
            : undefined}
          onClose={() => setEditar(null)}
          onSuccess={() => { setEditar(null); cargar() }}
        />
      )}
      {completar && (
        <CompletarModal
          grupo={completar}
          onClose={() => setCompletar(null)}
          onSuccess={() => { setCompletar(null); cargar() }}
        />
      )}
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-600 mb-1.5">{titulo}</h2>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-200">
        {children}
      </div>
    </section>
  )
}

/**
 * Un plan de un día: el título combina lo que se hace ese día ("Vacuna 1 +
 * Vacuna 2") y las acciones son del plan entero. Editar y eliminar sí van por
 * trabajo — son columnas distintas de la grilla —, así que con más de uno se
 * muestra un chip por trabajo con sus dos botones.
 */
function PlanRow({ grupo, vetNombre, onCompletar, onCompartir, onEditar, onEliminar }: {
  grupo:        GrupoPlan
  vetNombre?:   string | null
  onCompletar?: () => void
  onCompartir?: () => void
  onEditar?:    (t: TrabajoSanitario) => void
  onEliminar?:  (t: TrabajoSanitario) => void
}) {
  const uno       = grupo.trabajos.length === 1 ? grupo.trabajos[0] : null
  // Realizado: los que efectivamente lo recibieron. Pendiente: los convocados.
  const incluidos = new Set(
    grupo.trabajos.flatMap((t) => (t.caballos ?? []).filter((c) => !c.excluido).map((c) => c.caballo_id)),
  ).size
  const nCaballos = grupo.estado === 'realizado' ? incluidos : grupo.nCaballos
  const observaciones = [...new Set(grupo.trabajos.map((t) => t.observaciones).filter(Boolean))].join(' · ')

  return (
    <div className="px-4 py-3 text-sm">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-900">{grupo.titulo}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ESTADO_BADGE[grupo.estado]}`}>
              {LABEL_ESTADO_TRABAJO[grupo.estado]}
            </span>
            {vetNombre && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                <Stethoscope size={10} /> {vetNombre}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-slate-400">
            <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {formatFecha(grupo.fecha)}</span>
            <span>{nCaballos} caballo{nCaballos !== 1 ? 's' : ''}</span>
            {grupo.trabajos.length > 1 && <span>· {grupo.trabajos.length} trabajos</span>}
            {grupo.tratamientos && <span>· {grupo.tratamientos}</span>}
          </div>
          {observaciones && <p className="text-xs text-slate-400 mt-1">{observaciones}</p>}
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {uno && onEditar && (
            <button
              onClick={() => onEditar(uno)}
              title="Editar el trabajo programado"
              aria-label="Editar el trabajo programado"
              className="rounded-md border border-slate-300 p-1.5 text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-800"
            >
              <Pencil size={13} />
            </button>
          )}
          {uno && onEliminar && (
            <button
              onClick={() => onEliminar(uno)}
              title="Eliminar el trabajo programado"
              aria-label="Eliminar el trabajo programado"
              className="rounded-md border border-slate-300 p-1.5 text-slate-500 transition-colors hover:border-red-300 hover:text-red-600"
            >
              <Trash2 size={13} />
            </button>
          )}
          {onCompartir && (
            <button
              onClick={onCompartir}
              title={vetNombre ? 'Cambiar el veterinario' : 'Compartir con un veterinario'}
              className="flex items-center gap-1 rounded-md border border-slate-300 hover:border-slate-400 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors"
            >
              <Share2 size={13} /> {vetNombre ? 'Cambiar' : 'Compartir'}
            </button>
          )}
          {onCompletar && (
            <button
              onClick={onCompletar}
              className="flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1.5 text-xs font-medium text-white transition-colors"
            >
              <Check size={13} /> Realizado
            </button>
          )}
        </div>
      </div>

      {/* Con varios trabajos el mismo día, editar y eliminar van por columna */}
      {!uno && (onEditar || onEliminar) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {grupo.trabajos.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-2.5 pr-1.5 text-[11px] text-slate-600"
            >
              {t.nombre}
              {onEditar && (
                <button
                  onClick={() => onEditar(t)}
                  title={`Editar ${t.nombre}`}
                  aria-label={`Editar ${t.nombre}`}
                  className="rounded p-0.5 text-slate-400 transition-colors hover:text-brand-600"
                >
                  <Pencil size={12} />
                </button>
              )}
              {onEliminar && (
                <button
                  onClick={() => onEliminar(t)}
                  title={`Eliminar ${t.nombre}`}
                  aria-label={`Eliminar ${t.nombre}`}
                  className="rounded p-0.5 text-slate-400 transition-colors hover:text-red-600"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Modal: compartir un plan ya creado con un veterinario ────────────────────
function CompartirModal({
  trabajo, trabajos, vets, onClose, onSuccess,
}: {
  trabajo:  TrabajoSanitario
  /** Todos los trabajos cargados: se comparte el plan entero, no la fila sola. */
  trabajos: TrabajoSanitario[]
  vets:     VeterinarioPlataforma[]
  onClose:   () => void
  onSuccess: () => void
}) {
  const [vetId,     setVetId]     = useState(trabajo.compartido_con ?? '')
  const [sinAcceso, setSinAcceso] = useState<CaballoSinAcceso[] | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  const delPlan     = trabajos.filter((t) => t.plan_id === trabajo.plan_id)
  const trabajoIds  = delPlan.map((t) => t.id)
  const caballoIds  = [...new Set(delPlan.flatMap((t) => (t.caballos ?? []).map((c) => c.caballo_id)))]
  const vetElegido  = vets.find((v) => v.id === vetId) ?? null

  async function compartir(otorgarAcceso: boolean) {
    setSaving(true)
    try {
      await sanidadService.compartirTrabajos(trabajoIds, vetId, otorgarAcceso)
      onSuccess()
    } catch (e) {
      setError(mensajeError(e, 'Error al compartir.'))
      setSaving(false)
      setSinAcceso(null)
    }
  }

  async function confirmar() {
    setError('')
    if (!vetId) return setError('Elegí un veterinario.')
    setSaving(true)
    try {
      const faltantes = await sanidadService.caballosSinAcceso(vetId, caballoIds)
      if (faltantes.length > 0) {
        setSinAcceso(faltantes)
        setSaving(false)
        return
      }
    } catch (e) {
      setError(mensajeError(e, 'No se pudo verificar el acceso del veterinario.'))
      setSaving(false)
      return
    }
    await compartir(false)
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
        onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}
      >
        <div className="w-full max-w-md sm:mx-4 rounded-t-2xl sm:rounded-xl border border-slate-300 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <Share2 size={16} className="text-brand-600" />
              <h2 className="text-sm font-semibold text-slate-900">Compartir plan sanitario</h2>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
          </div>

          <div className="px-5 py-4 space-y-3">
            <p className="text-xs text-slate-500">
              {delPlan.length > 1
                ? `Se comparten los ${delPlan.length} trabajos del plan`
                : `Se comparte “${trabajo.nombre}”`}
              {' '}sobre {caballoIds.length} caballo{caballoIds.length !== 1 ? 's' : ''}.
            </p>

            <select
              value={vetId}
              onChange={(e) => setVetId(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">— Elegí un veterinario —</option>
              {vets.map((v) => <option key={v.id} value={v.id}>{v.apellido}, {v.nombre}</option>)}
            </select>

            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={confirmar}
              disabled={saving || !vetId}
              className="px-4 py-2 text-sm font-medium rounded-md bg-brand-500 hover:bg-brand-400 text-white transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Compartir'}
            </button>
          </div>
        </div>
      </div>

      {sinAcceso && vetElegido && (
        <ConfirmarAccesoVetModal
          vetNombre={`${vetElegido.nombre} ${vetElegido.apellido}`}
          caballos={sinAcceso}
          textoConfirmar="Otorgar acceso y compartir"
          saving={saving}
          onConfirmar={() => compartir(true)}
          onCancelar={() => setSinAcceso(null)}
        />
      )}
    </>
  )
}

// ── Modal: marcar realizado (con exclusión) ──────────────────────────────────
/**
 * Cierra el plan del día entero: si ese día había vacuna 1 y vacuna 2, se
 * marcan las dos sobre los caballos tildados. La exclusión es por caballo, no
 * por trabajo — "fui, y a este no se lo di" vale para todo lo de ese día.
 */
function CompletarModal({
  grupo, onClose, onSuccess,
}: {
  grupo: GrupoPlan
  onClose: () => void
  onSuccess: () => void
}) {
  /** Un renglón por caballo, con las filas que le corresponden en cada trabajo. */
  const caballos = useMemo(() => {
    const mapa = new Map<string, { nombre: string; excluido: boolean }>()
    for (const t of grupo.trabajos) {
      for (const c of t.caballos ?? []) {
        const previo = mapa.get(c.caballo_id)
        mapa.set(c.caballo_id, {
          nombre:   c.caballo ? nombreCaballo(c.caballo) : c.caballo_id,
          // Alcanza con estar incluido en un trabajo para arrancar tildado.
          excluido: (previo?.excluido ?? true) && c.excluido,
        })
      }
    }
    return [...mapa.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [grupo.trabajos])

  // incluidos = los caballos que reciben el trabajo. Arrancan todos incluidos.
  const [incluidos, setIncluidos] = useState<Set<string>>(
    () => new Set(caballos.filter((c) => !c.excluido).map((c) => c.id)),
  )
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function toggle(id: string) {
    setIncluidos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function confirmar() {
    setError('')
    if (incluidos.size === 0) return setError('Seleccioná al menos un caballo, o cancelá.')
    setSaving(true)
    try {
      // Uno por uno: cada trabajo escribe su propia fila de historial por caballo.
      for (const t of grupo.trabajos) {
        const excluidoRowIds = (t.caballos ?? [])
          .filter((c) => !incluidos.has(c.caballo_id))
          .map((c) => c.id)
        await sanidadService.completarTrabajo(t.id, excluidoRowIds)
      }
      onSuccess()
    } catch (e) {
      setError(mensajeError(e, 'Error al completar.'))
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md sm:mx-4 rounded-t-2xl sm:rounded-xl border border-slate-300 bg-white shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Marcar realizado</h2>
              <p className="text-xs text-slate-500 mt-0.5">{grupo.titulo}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          <p className="text-xs text-slate-500">
            {grupo.trabajos.length > 1
              ? `Se marcan los ${grupo.trabajos.length} trabajos del día y se cargan en el historial de los caballos tildados. `
              : 'Se cargará en el historial de los caballos marcados. '}
            Destildá los que no corresponda (quedan excluidos).
          </p>
          <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
            {caballos.map((c) => (
              <label key={c.id} className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={incluidos.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-slate-700">{c.nombre}</span>
              </label>
            ))}
          </div>
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600">
              <X size={13} /> {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando…' : `Realizar (${incluidos.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}
