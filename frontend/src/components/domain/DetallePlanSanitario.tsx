import { useEffect, useMemo, useState } from 'react'
import { Check, X, Clock, AlertCircle, CalendarPlus, CalendarClock, Pencil, Trash2 } from 'lucide-react'
import { sanidadService } from '../../services/sanidadService'
import { useAuthStore } from '../../store/authStore'
import EditarTrabajoSanitarioModal from './EditarTrabajoSanitarioModal'
import { nombreCaballo } from '../../utils/caballo'
import { mensajeError } from '../../utils/error'
import { hoyAR } from '../../utils/fecha'
import type { EstadoCaballoTrabajo, TrabajoSanitario } from '../../types/sanidad'
import Spinner from '../ui/Spinner'

interface Props {
  /** Plan a mostrar: sus trabajos son las columnas de la grilla. */
  planId: string
  /**
   * Día que se está mirando. Un plan puede tener trabajos en varias fechas
   * (vacunar el 27, herrar el 28) y cada uno se cierra el día que se hizo, así
   * que la grilla se acota a esa fecha. Sin esto pedía marcar también las
   * columnas de días futuros para poder guardar, y marcarlas como "posponer"
   * disparaba una reprogramación que partía el plan en dos.
   */
  fecha?: string
  /** Se dispara al cerrar el plan o al reprogramar, para refrescar el calendario. */
  onCambio?: () => void
}

/** DD/MM, para diferenciar columnas del mismo plan en distintas fechas. */
function fechaCorta(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

const OPCIONES: { estado: EstadoCaballoTrabajo; icono: typeof Check; titulo: string; activo: string }[] = [
  { estado: 'realizado',    icono: Check, titulo: 'Realizado',    activo: 'bg-emerald-500 text-white border-emerald-500' },
  { estado: 'no_realizado', icono: X,     titulo: 'No realizado',  activo: 'bg-red-500 text-white border-red-500' },
  { estado: 'pendiente',    icono: Clock, titulo: 'Pendiente',     activo: 'bg-amber-500 text-white border-amber-500' },
]

/** Clave de una celda de la grilla. */
const celda = (trabajoId: string, caballoId: string) => `${trabajoId}|${caballoId}`

export default function DetallePlanSanitario({ planId, fecha, onCambio }: Props) {
  const userId = useAuthStore((s) => s.user?.id)
  const rol    = useAuthStore((s) => s.rol)
  const esAdmin = rol === 'admin' || rol === 'superadmin'

  const [todos, setTodos] = useState<TrabajoSanitario[]>([])
  const [cargando, setCargando] = useState(true)
  const [error,    setError]    = useState('')
  const [recarga,  setRecarga]  = useState(0)

  /** Estado elegido en pantalla por celda; arranca de lo guardado. */
  const [marcas, setMarcas] = useState<Record<string, EstadoCaballoTrabajo>>({})
  const [guardando,   setGuardando]   = useState(false)
  const [reprogramar, setReprogramar] = useState(false)
  const [moviendo,    setMoviendo]    = useState(false)
  const [editando,    setEditando]    = useState<TrabajoSanitario | null>(null)
  const [fechaNueva,  setFechaNueva]  = useState(hoyAR())
  const [aviso,       setAviso]       = useState('')

  useEffect(() => {
    let vigente = true
    setCargando(true)
    sanidadService.listarPlan(planId)
      .then((t) => {
        if (!vigente) return
        setTodos(t)
        const previas: Record<string, EstadoCaballoTrabajo> = {}
        t.forEach((tr) => tr.caballos?.forEach((c) => {
          if (c.estado) previas[celda(tr.id, c.caballo_id)] = c.estado
        }))
        setMarcas(previas)
      })
      .catch((e) => { if (vigente) setError(mensajeError(e, 'No se pudo cargar el plan.')) })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [planId, recarga])

  /**
   * Las columnas son solo los trabajos del día que se está mirando: cada fecha
   * del plan se cierra por separado, el día que se hizo.
   */
  const trabajos = useMemo(
    () => fecha ? todos.filter((t) => t.fecha_programada === fecha) : todos,
    [todos, fecha],
  )

  /** Las otras fechas del plan, para avisar que existen y no se cierran acá. */
  const otrasFechas = useMemo(
    () => [...new Set(todos.filter((t) => t.fecha_programada !== fecha).map((t) => t.fecha_programada))].sort(),
    [todos, fecha],
  )

  /** Filas de la grilla: un caballo por fila, aunque no esté en todos los trabajos. */
  const caballos = useMemo(() => {
    const map = new Map<string, string>()
    trabajos.forEach((t) => t.caballos?.forEach((c) => {
      map.set(c.caballo_id, c.caballo ? nombreCaballo(c.caballo) : c.caballo_id)
    }))
    return [...map.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [trabajos])

  /** Id de la fila `trabajo_sanitario_caballo`, o null si el caballo no está en ese trabajo. */
  function filaDe(trabajo: TrabajoSanitario, caballoId: string): string | null {
    return trabajo.caballos?.find((c) => c.caballo_id === caballoId)?.id ?? null
  }

  const celdasTotales = useMemo(
    () => trabajos.flatMap((t) => (t.caballos ?? []).map((c) => celda(t.id, c.caballo_id))),
    [trabajos],
  )
  const sinMarcar  = celdasTotales.filter((k) => !marcas[k])
  const pendientes = celdasTotales.filter((k) => marcas[k] === 'pendiente')
  const cerrado    = trabajos.length > 0 && trabajos.every((t) => t.estado !== 'pendiente')

  /**
   * Mover o corregir un trabajo lo puede quien lo programó, la empresa dueña y
   * el veterinario al que se le asignó — el que va a ir a hacerlo. Borrarlo no:
   * la RLS solo deja al autor, al admin de la empresa y al vet dueño.
   */
  function puedeTocar(t: TrabajoSanitario): boolean {
    return t.estado === 'pendiente' &&
      (t.creado_por === userId || esAdmin || t.vet_owner_id === userId || t.compartido_con === userId)
  }
  function puedeBorrar(t: TrabajoSanitario): boolean {
    return t.estado === 'pendiente' &&
      (t.creado_por === userId || esAdmin || t.vet_owner_id === userId)
  }

  const gestionables = trabajos.filter(puedeTocar)

  /** Mueve el día entero de una: todos los trabajos, con todos sus caballos. */
  async function moverTodo() {
    setError('')
    setGuardando(true)
    try {
      await sanidadService.reprogramarTrabajos(gestionables.map((t) => t.id), fechaNueva)
      setMoviendo(false)
      setAviso(`Se movieron ${gestionables.length} trabajo${gestionables.length !== 1 ? 's' : ''} al ${fechaNueva}.`)
      onCambio?.()
    } catch (e) {
      setError(mensajeError(e, 'No se pudo reprogramar.'))
    } finally {
      setGuardando(false)
    }
  }

  async function eliminarTrabajo(t: TrabajoSanitario) {
    const cuantos = t.caballos?.length ?? 0
    const ok = window.confirm(
      `¿Eliminar el trabajo “${t.nombre}” del ${t.fecha_programada}?\n\n` +
      `Se borra para los ${cuantos} caballo${cuantos !== 1 ? 's' : ''} del trabajo. No se puede deshacer.`,
    )
    if (!ok) return
    setError('')
    setGuardando(true)
    try {
      await sanidadService.eliminarTrabajos([t.id])
      setAviso(`Se eliminó “${t.nombre}”.`)
      onCambio?.()
      setRecarga((n) => n + 1)
    } catch (e) {
      setError(mensajeError(e, 'No se pudo eliminar.'))
    } finally {
      setGuardando(false)
    }
  }

  async function guardar() {
    if (sinMarcar.length > 0) {
      return setError(`Faltan marcar ${sinMarcar.length} casillero${sinMarcar.length !== 1 ? 's' : ''}.`)
    }
    setError('')
    setGuardando(true)
    try {
      const items = trabajos.flatMap((t) =>
        (t.caballos ?? []).map((c) => ({
          caballoRowId: c.id,
          estado:       marcas[celda(t.id, c.caballo_id)],
        })),
      )
      const nHist = await sanidadService.cerrarPlan(items)
      setAviso(`Plan guardado. Se cargaron ${nHist} registro${nHist !== 1 ? 's' : ''} en el historial.`)
      const frescos = await sanidadService.listarPlan(planId)
      setTodos(frescos)
      // Guardado el resultado, lo que quedó pendiente se lleva a una fecha nueva.
      // El aviso al calendario se difiere hasta cerrar ese paso: recargarlo ahora
      // desmontaría este panel junto con la fecha a medio elegir.
      if (pendientes.length > 0) setReprogramar(true)
      else onCambio?.()
    } catch (e) {
      setError(mensajeError(e, 'No se pudo guardar.'))
    } finally {
      setGuardando(false)
    }
  }

  async function confirmarReprogramacion() {
    if (!userId) return
    setError('')
    setGuardando(true)
    try {
      const grupos = trabajos.map((t) => ({
        trabajo: t,
        caballoIds: (t.caballos ?? [])
          .filter((c) => marcas[celda(t.id, c.caballo_id)] === 'pendiente')
          .map((c) => c.caballo_id),
      }))
      const creados = await sanidadService.reprogramarPendientes(grupos, fechaNueva, userId)
      setReprogramar(false)
      setAviso(`Se reprogramaron ${creados.length} trabajo${creados.length !== 1 ? 's' : ''} para el ${fechaNueva}.`)
      onCambio?.()
    } catch (e) {
      setError(mensajeError(e, 'No se pudo reprogramar.'))
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <div className="flex justify-center py-6"><Spinner /></div>

  return (
    <div className="space-y-3 px-4 py-3">
      {/* Grilla caballo × trabajo */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Caballo</th>
              {trabajos.map((t) => (
                <th key={t.id} className="px-3 py-2 text-center text-xs font-semibold text-slate-500 whitespace-nowrap">
                  {t.nombre}
                  <span className="mt-0.5 block text-[10px] font-normal text-slate-400">
                    {fechaCorta(t.fecha_programada)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {caballos.map((cab) => (
              <tr key={cab.id}>
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{cab.nombre}</td>
                {trabajos.map((t) => {
                  const fila = filaDe(t, cab.id)
                  const key  = celda(t.id, cab.id)
                  if (!fila) {
                    return <td key={t.id} className="px-3 py-2 text-center text-xs text-slate-300">—</td>
                  }
                  return (
                    <td key={t.id} className="px-3 py-2">
                      <div className="flex justify-center gap-1">
                        {OPCIONES.map(({ estado, icono: Icono, titulo, activo }) => {
                          const sel = marcas[key] === estado
                          return (
                            <button
                              key={estado}
                              type="button"
                              disabled={cerrado}
                              title={titulo}
                              aria-label={`${titulo} — ${cab.nombre} / ${t.nombre}`}
                              onClick={() => setMarcas((prev) => ({ ...prev, [key]: estado }))}
                              className={`rounded-md border p-1 transition-colors disabled:opacity-60 ${
                                sel ? activo : 'border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-600'
                              }`}
                            >
                              <Icono size={13} />
                            </button>
                          )
                        })}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {otrasFechas.length > 0 && (
        <p className="text-[11px] text-slate-400">
          Este plan también tiene trabajos el {otrasFechas.map(fechaCorta).join(', ')}.
          Se cierran desde su propio día en el calendario.
        </p>
      )}

      {/* Acciones sobre el trabajo entero, sin tener que marcar casillero por casillero */}
      {!cerrado && gestionables.length > 0 && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setMoviendo((v) => !v); setReprogramar(false) }}
              disabled={guardando}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900 disabled:opacity-50"
            >
              <CalendarClock size={13} />
              {gestionables.length > 1 ? `Reprogramar los ${gestionables.length} trabajos` : 'Reprogramar el trabajo'}
            </button>
            <span className="text-[11px] text-slate-400">
              Mueve el trabajo completo, con todos sus caballos, a otra fecha.
            </span>
          </div>

          {moviendo && (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">Nueva fecha</label>
                <input
                  type="date"
                  value={fechaNueva}
                  onChange={(e) => setFechaNueva(e.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <button
                type="button"
                onClick={moverTodo}
                disabled={guardando}
                className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-400 disabled:opacity-50"
              >
                {guardando ? 'Moviendo…' : 'Mover a esa fecha'}
              </button>
              <button
                type="button"
                onClick={() => setMoviendo(false)}
                className="px-2 py-1.5 text-xs text-slate-500 transition-colors hover:text-slate-700"
              >
                Cancelar
              </button>
            </div>
          )}

          {/* Editar / eliminar, por trabajo: cada columna de la grilla es uno */}
          <div className="flex flex-wrap gap-1.5">
            {gestionables.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-2.5 pr-1.5 text-[11px] text-slate-600"
              >
                {t.nombre}
                <button
                  type="button"
                  onClick={() => setEditando(t)}
                  disabled={guardando}
                  title={`Editar ${t.nombre}`}
                  aria-label={`Editar ${t.nombre}`}
                  className="rounded p-0.5 text-slate-400 transition-colors hover:text-brand-600 disabled:opacity-50"
                >
                  <Pencil size={12} />
                </button>
                {puedeBorrar(t) && (
                  <button
                    type="button"
                    onClick={() => eliminarTrabajo(t)}
                    disabled={guardando}
                    title={`Eliminar ${t.nombre}`}
                    aria-label={`Eliminar ${t.nombre}`}
                    className="rounded p-0.5 text-slate-400 transition-colors hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600">
          <AlertCircle size={13} /> {error}
        </div>
      )}
      {aviso && <p className="text-xs text-emerald-600">{aviso}</p>}

      {/* Acciones */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-400">
          {cerrado
            ? 'Plan cerrado.'
            : sinMarcar.length > 0
              ? `Faltan ${sinMarcar.length} de ${celdasTotales.length} casilleros.`
              : 'Todo marcado.'}
        </p>
        {!cerrado && (
          <button
            type="button"
            onClick={guardar}
            disabled={guardando || sinMarcar.length > 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-400 disabled:opacity-50"
          >
            {pendientes.length > 0 && <CalendarPlus size={13} />}
            {guardando
              ? 'Guardando…'
              : pendientes.length > 0 ? 'Guardar y reprogramar' : 'Guardar plan'}
          </button>
        )}
      </div>

      {/* Reprogramación: crea un plan nuevo solo con lo pendiente */}
      {reprogramar && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Nueva fecha</label>
            <input
              type="date"
              value={fechaNueva}
              onChange={(e) => setFechaNueva(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <button
            type="button"
            onClick={confirmarReprogramacion}
            disabled={guardando}
            className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-400 disabled:opacity-50"
          >
            {guardando ? 'Creando…' : 'Crear plan reprogramado'}
          </button>
          <button
            type="button"
            onClick={() => { setReprogramar(false); onCambio?.() }}
            className="px-2 py-1.5 text-xs text-slate-500 transition-colors hover:text-slate-700"
          >
            Ahora no
          </button>
          <p className="basis-full text-[11px] text-slate-400">
            El resultado ya quedó guardado. Elegí la fecha para los {pendientes.length} casillero
            {pendientes.length !== 1 ? 's' : ''} que quedaron pendientes.
          </p>
        </div>
      )}

      {editando && (
        <EditarTrabajoSanitarioModal
          trabajo={editando}
          onEliminar={puedeBorrar(editando)
            ? () => { const t = editando; setEditando(null); eliminarTrabajo(t) }
            : undefined}
          onClose={() => setEditando(null)}
          onSuccess={() => {
            setEditando(null)
            setAviso('Trabajo actualizado.')
            setRecarga((n) => n + 1)
            onCambio?.()
          }}
        />
      )}
    </div>
  )
}
