import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, X, Clock, AlertCircle, CalendarClock, CalendarPlus, ChevronDown, Pencil, Trash2, Building2, Stethoscope, MapPin, Search } from 'lucide-react'
import { sanidadService } from '../../services/sanidadService'
import { useAuthStore } from '../../store/authStore'
import EditarTrabajoSanitarioModal from './EditarTrabajoSanitarioModal'
import NombreCaballoLink from './NombreCaballoLink'
import { nombreCaballo, textoBusquedaCaballo } from '../../utils/caballo'
import { mensajeError } from '../../utils/error'
import { hoyAR } from '../../utils/fecha'
import { LABEL_ESTADO_CABALLO, type EstadoCaballoTrabajo, type TrabajoSanitario } from '../../types/sanidad'

interface Props {
  /** Todos los trabajos sanitarios del día, de todos los planes y empresas. */
  trabajos: TrabajoSanitario[]
  /** El vet trabaja con varias empresas; el admin ve la suya y las de sus vets. */
  esVet:    boolean
  empresas: Map<string, string>
  /** Se dispara al reprogramar, editar o eliminar: refresca el calendario. */
  onCambio: () => void
}

/** Una fila de la tabla: un caballo dentro de un trabajo. */
interface Fila {
  rowId:     string
  caballoId: string
  caballo:   string
  /** Nombre + RP en minúsculas: sobre esto matchea el buscador. */
  texto:     string
  /** Potrero donde está el animal: dice a qué campo hay que ir. */
  campo:     string | null
  trabajo:   TrabajoSanitario
}

/** Los trabajos de una empresa (o los propios del vet): un desplegable. */
interface GrupoEmpresa {
  clave:     string
  nombre:    string
  filas:     Fila[]
  trabajos:  TrabajoSanitario[]
  nCaballos: number
}

const OPCIONES: { estado: EstadoCaballoTrabajo; icono: typeof Check; activo: string }[] = [
  { estado: 'realizado',    icono: Check, activo: 'bg-emerald-500 text-white border-emerald-500' },
  { estado: 'no_realizado', icono: X,     activo: 'bg-red-500 text-white border-red-500' },
  { estado: 'pendiente',    icono: Clock, activo: 'bg-amber-500 text-white border-amber-500' },
]

/** Un plan propio de un vet no tiene empresa: es su propio grupo. */
function claveEmpresa(t: TrabajoSanitario): string {
  return t.sociedad_id ?? `vet:${t.vet_owner_id}`
}

const BADGE_CELDA: Record<EstadoCaballoTrabajo, string> = {
  realizado:    'bg-emerald-100 text-emerald-700',
  no_realizado: 'bg-red-100 text-red-700',
  pendiente:    'bg-amber-100 text-amber-700',
}

/**
 * Los trabajos sanitarios de un día, en un desplegable por empresa y adentro una
 * sola tabla agrupada por caballo. Antes cada plan era su propia caja: con diez
 * trabajos sobre diez padrones había que abrir diez para saber qué hacer ese día.
 *
 * "Realizado" y "no realizado" se guardan solos, uno por clic: son el resultado
 * de algo que ya pasó. "Pendiente" no, porque lo que queda pendiente hay que
 * llevarlo a otra fecha, y esa fecha se elige una sola vez para todo lo marcado.
 */
export default function TrabajosDelDia({ trabajos, esVet, empresas, onCambio }: Props) {
  const userId  = useAuthStore((s) => s.user?.id)
  const rol     = useAuthStore((s) => s.rol)
  const esAdmin = rol === 'admin' || rol === 'superadmin'

  /** Estado visible de cada celda. */
  const [marcas,     setMarcas]     = useState<Record<string, EstadoCaballoTrabajo>>({})
  /** Lo que ya está confirmado en la base, para poder revertir si falla el guardado. */
  const [persistido, setPersistido] = useState<Record<string, EstadoCaballoTrabajo>>({})
  const [enVuelo,    setEnVuelo]    = useState<string[]>([])

  const [guardando, setGuardando] = useState(false)
  const [error,     setError]     = useState('')
  const [aviso,     setAviso]     = useState('')

  const [cerrados,   setCerrados]   = useState<string[]>([])
  const [moviendo,   setMoviendo]   = useState<string | null>(null)
  const [fechaNueva, setFechaNueva] = useState(hoyAR())
  const [editando,   setEditando]   = useState<TrabajoSanitario | null>(null)

  const [busqueda, setBusqueda] = useState('')
  /** Primera fila que matchea: es a donde salta el buscador. */
  const filaRef = useRef<HTMLTableRowElement | null>(null)

  const filas = useMemo(() => {
    const out: Fila[] = []
    for (const t of trabajos) {
      for (const c of t.caballos ?? []) {
        // Excluido y sin marcar = lo sacó la baja del caballo (o el flujo viejo
        // de Sanidad). No hay nada que hacerle ese día.
        if (c.excluido && !c.estado) continue
        out.push({
          rowId:     c.id,
          caballoId: c.caballo_id,
          caballo:   c.caballo ? nombreCaballo(c.caballo) : 'Sin nombre',
          texto:     c.caballo ? textoBusquedaCaballo(c.caballo) : '',
          campo:     c.caballo?.campo?.nombre ?? null,
          trabajo:   t,
        })
      }
    }
    // Agrupado por caballo: se agarra el animal una vez y se le hace todo lo que
    // tiene ese día, en vez de recorrer el padrón entero por cada trabajo.
    return out.sort((a, b) =>
      a.caballo.localeCompare(b.caballo) || a.trabajo.nombre.localeCompare(b.trabajo.nombre))
  }, [trabajos])

  /** Un desplegable por empresa: el plan propio de un vet es su propio grupo. */
  const grupos = useMemo(() => {
    const mapa = new Map<string, GrupoEmpresa>()
    for (const f of filas) {
      const t     = f.trabajo
      const clave = claveEmpresa(t)
      const nombre = t.sociedad_id
        ? empresas.get(t.sociedad_id) ?? 'Empresa'
        : 'Mis caballos'
      const g = mapa.get(clave) ?? { clave, nombre, filas: [], trabajos: [], nCaballos: 0 }
      g.filas.push(f)
      if (!g.trabajos.some((x) => x.id === t.id)) g.trabajos.push(t)
      mapa.set(clave, g)
    }
    for (const g of mapa.values()) g.nCaballos = new Set(g.filas.map((f) => f.caballoId)).size
    return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [filas, empresas])

  // Datos nuevos (otro día, o una recarga) → se relee lo guardado.
  useEffect(() => {
    const previas: Record<string, EstadoCaballoTrabajo> = {}
    for (const t of trabajos) {
      for (const c of t.caballos ?? []) if (c.estado) previas[c.id] = c.estado
    }
    setMarcas(previas)
    setPersistido(previas)
    setError('')
  }, [trabajos])

  /**
   * El buscador no filtra: lleva. Un caballo puede estar en cualquiera de los
   * desplegables y con veinte animales por empresa no se sabe en cuál — así que
   * se abre el grupo donde está, se baja hasta él y se le deja el fondo marcado.
   */
  const coincidencias = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return [] as Fila[]
    return filas.filter((f) => f.texto.includes(q))
  }, [filas, busqueda])

  const resaltadas = useMemo(() => new Set(coincidencias.map((f) => f.rowId)), [coincidencias])
  const primera    = coincidencias[0]?.rowId ?? null

  useEffect(() => {
    if (coincidencias.length === 0) return
    // Si el caballo cayó en un grupo cerrado, no alcanza con marcarlo: hay que
    // abrirlo antes de poder bajar hasta la fila.
    const claves = new Set(coincidencias.map((f) => claveEmpresa(f.trabajo)))
    setCerrados((prev) => prev.filter((c) => !claves.has(c)))
    // El scroll espera al re-render que abre el grupo.
    const id = requestAnimationFrame(() =>
      filaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    return () => cancelAnimationFrame(id)
  }, [coincidencias])

  /**
   * Lo marcado como pendiente que todavía no se guardó: se cierra recién cuando
   * se elige la fecha nueva, así una celda pendiente nunca queda sin destino.
   */
  const aReprogramar = useMemo(
    () => filas.filter((f) => marcas[f.rowId] === 'pendiente' && persistido[f.rowId] !== 'pendiente'),
    [filas, marcas, persistido],
  )

  /** Borrar solo el autor, el admin de la empresa y el vet dueño: lo exige la RLS. */
  function puedeBorrar(t: TrabajoSanitario): boolean {
    return t.estado === 'pendiente' &&
      (t.creado_por === userId || esAdmin || t.vet_owner_id === userId)
  }

  /**
   * Mover o corregir un trabajo lo puede quien lo programó, la empresa dueña y
   * el veterinario al que se le asignó — el que va a ir a hacerlo.
   */
  function gestionable(t: TrabajoSanitario): boolean {
    return t.estado === 'pendiente' &&
      (t.creado_por === userId || esAdmin || t.vet_owner_id === userId || t.compartido_con === userId)
  }

  /** Quién programó el trabajo. El vet ya tiene la empresa en el encabezado. */
  function creador(t: TrabajoSanitario): string | null {
    if (esVet || t.creado_por === userId || !t.creador) return null
    return `${t.creador.nombre} ${t.creador.apellido}`
  }

  /**
   * Un clic = un guardado. Se pinta la celda antes de que responda el servidor y
   * se revierte si falla: marcar veinte caballos no puede esperar veinte veces.
   */
  async function marcar(f: Fila, estado: EstadoCaballoTrabajo) {
    setAviso('')
    if (estado === 'pendiente') {
      // Todavía no va a la base: junta con el resto para elegir una sola fecha.
      setMarcas((prev) => ({ ...prev, [f.rowId]: estado }))
      return
    }
    const previo = marcas[f.rowId]
    setMarcas((prev) => ({ ...prev, [f.rowId]: estado }))
    setEnVuelo((prev) => [...prev, f.rowId])
    try {
      await sanidadService.cerrarPlan([{ caballoRowId: f.rowId, estado }])
      setPersistido((prev) => ({ ...prev, [f.rowId]: estado }))
      setError('')
    } catch (e) {
      setMarcas((prev) => {
        const next = { ...prev }
        if (previo) next[f.rowId] = previo
        else delete next[f.rowId]
        return next
      })
      setError(mensajeError(e, 'No se pudo guardar la marca.'))
    } finally {
      setEnVuelo((prev) => prev.filter((id) => id !== f.rowId))
    }
  }

  /** Guarda los pendientes y crea el plan nuevo con ellos en la fecha elegida. */
  async function confirmarReprogramacion() {
    if (!userId) return
    setError('')
    setGuardando(true)
    try {
      await sanidadService.cerrarPlan(
        aReprogramar.map((f) => ({ caballoRowId: f.rowId, estado: 'pendiente' as const })),
      )
      const porTrabajo = new Map<string, { trabajo: TrabajoSanitario; caballoIds: string[] }>()
      for (const f of aReprogramar) {
        const g = porTrabajo.get(f.trabajo.id) ?? { trabajo: f.trabajo, caballoIds: [] }
        g.caballoIds.push(f.caballoId)
        porTrabajo.set(f.trabajo.id, g)
      }
      const creados = await sanidadService.reprogramarPendientes([...porTrabajo.values()], fechaNueva, userId)
      setAviso(`Se reprogramaron ${creados.length} trabajo${creados.length !== 1 ? 's' : ''} para el ${fechaNueva}.`)
      onCambio()
    } catch (e) {
      setError(mensajeError(e, 'No se pudo reprogramar.'))
    } finally {
      setGuardando(false)
    }
  }

  /** Deja los relojes sin efecto: nada de eso llegó a guardarse. */
  function descartarPendientes() {
    setMarcas((prev) => {
      const next = { ...prev }
      for (const f of aReprogramar) {
        if (persistido[f.rowId]) next[f.rowId] = persistido[f.rowId]
        else delete next[f.rowId]
      }
      return next
    })
  }

  /** Mueve trabajos enteros de una empresa, con todos sus caballos, a otra fecha. */
  async function moverTodo(grupo: GrupoEmpresa) {
    const ids = grupo.trabajos.filter(gestionable).map((t) => t.id)
    setError('')
    setGuardando(true)
    try {
      await sanidadService.reprogramarTrabajos(ids, fechaNueva)
      setMoviendo(null)
      setAviso(`Se movieron ${ids.length} trabajo${ids.length !== 1 ? 's' : ''} al ${fechaNueva}.`)
      onCambio()
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
      onCambio()
    } catch (e) {
      setError(mensajeError(e, 'No se pudo eliminar.'))
    } finally {
      setGuardando(false)
    }
  }

  if (filas.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-slate-400">Sin trabajos para este día.</p>
  }

  return (
    <div className="space-y-3 px-4 py-3">
      {/* Buscar un caballo entre todas las empresas del día */}
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar caballo…"
          aria-label="Buscar caballo entre los trabajos del día"
          className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-24 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        {busqueda.trim() && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
            {coincidencias.length === 0
              ? 'sin resultados'
              : `${resaltadas.size} fila${resaltadas.size !== 1 ? 's' : ''}`}
          </span>
        )}
      </div>

      {grupos.map((g) => {
        const abierto      = !cerrados.includes(g.clave)
        const gestionables = g.trabajos.filter(gestionable)
        return (
          <section key={g.clave} className="overflow-hidden rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setCerrados((prev) =>
                prev.includes(g.clave) ? prev.filter((c) => c !== g.clave) : [...prev, g.clave])}
              aria-expanded={abierto}
              aria-label={`${abierto ? 'Contraer' : 'Desplegar'} los trabajos de ${g.nombre}`}
              className="flex w-full items-center justify-between gap-2 bg-slate-50 px-3 py-2 text-left transition-colors hover:bg-slate-100"
            >
              <span className="flex min-w-0 items-center gap-2">
                {g.clave.startsWith('vet:')
                  ? <Stethoscope size={14} className="shrink-0 text-slate-400" />
                  : <Building2 size={14} className="shrink-0 text-slate-400" />}
                <span className="truncate text-sm font-semibold text-slate-900">{g.nombre}</span>
                <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">
                  {g.trabajos.length} trabajo{g.trabajos.length !== 1 ? 's' : ''} · {g.nCaballos} caballo{g.nCaballos !== 1 ? 's' : ''}
                </span>
              </span>
              <ChevronDown size={15} className={`shrink-0 text-slate-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />
            </button>

            {abierto && (
              <>
                <div className="overflow-x-auto border-t border-slate-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-white">
                        <th className="px-2 py-2 text-left text-xs font-semibold text-slate-500 sm:px-3">Caballo</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold text-slate-500 sm:px-3">Trabajo</th>
                        {/* En el celular el detalle va debajo del trabajo: los
                            botones de estado tienen que entrar sin scroll. */}
                        <th className="hidden px-2 py-2 text-left text-xs font-semibold text-slate-500 sm:table-cell sm:px-3">Detalle</th>
                        <th className="px-2 py-2 text-center text-xs font-semibold text-slate-500 sm:px-3">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.filas.map((f, i) => {
                        const cerrado  = f.trabajo.estado !== 'pendiente'
                        const marca    = marcas[f.rowId]
                        const quien    = creador(f.trabajo)
                        const grabando = enVuelo.includes(f.rowId)
                        // El caballo se nombra una vez y sus trabajos quedan
                        // pegados debajo: la línea separa animales, no filas.
                        const abreGrupo = i === 0 || g.filas[i - 1].caballo !== f.caballo
                        const marcada = resaltadas.has(f.rowId)
                        return (
                          <tr
                            key={f.rowId}
                            ref={f.rowId === primera ? filaRef : undefined}
                            className={`${marcada ? 'bg-slate-200/70' : 'hover:bg-slate-50'} ${
                              abreGrupo && i > 0 ? 'border-t border-slate-200' : ''
                            }`}
                          >
                            <td className="whitespace-nowrap px-2 py-2 align-top font-medium text-slate-700 sm:px-3">
                              {abreGrupo && <NombreCaballoLink id={f.caballoId} nombre={f.caballo} />}
                            </td>
                            <td className="px-2 py-2 font-medium text-slate-900 sm:px-3">
                              {f.trabajo.nombre}
                              <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-normal text-slate-400 sm:hidden">
                                {f.campo && (
                                  <span className="inline-flex items-center gap-1">
                                    <MapPin size={10} /> {f.campo}
                                  </span>
                                )}
                                {f.trabajo.tratamiento}
                              </span>
                            </td>
                            <td className="hidden px-2 py-2 text-xs text-slate-400 sm:table-cell sm:px-3">
                              <span className="flex flex-wrap items-center gap-2">
                                {f.campo && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                    <MapPin size={10} /> {f.campo}
                                  </span>
                                )}
                                {quien && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                                    <Stethoscope size={10} /> {quien}
                                  </span>
                                )}
                                {f.trabajo.tratamiento && <span>{f.trabajo.tratamiento}</span>}
                              </span>
                            </td>
                            <td className="px-2 py-2 sm:px-3">
                              {cerrado ? (
                                <div className="flex justify-center">
                                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                    marca ? BADGE_CELDA[marca] : 'bg-slate-100 text-slate-500'
                                  }`}>
                                    {marca ? LABEL_ESTADO_CABALLO[marca] : 'Sin marcar'}
                                  </span>
                                </div>
                              ) : (
                                <div className={`flex justify-center gap-1 ${grabando ? 'opacity-50' : ''}`}>
                                  {OPCIONES.map(({ estado, icono: Icono, activo }) => {
                                    const sel = marca === estado
                                    return (
                                      <button
                                        key={estado}
                                        type="button"
                                        disabled={grabando}
                                        title={LABEL_ESTADO_CABALLO[estado]}
                                        aria-label={`${LABEL_ESTADO_CABALLO[estado]} — ${f.caballo} / ${f.trabajo.nombre}`}
                                        onClick={() => marcar(f, estado)}
                                        className={`rounded-md border p-1 transition-colors ${
                                          sel ? activo : 'border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-600'
                                        }`}
                                      >
                                        <Icono size={13} />
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Acciones sobre los trabajos enteros de esta empresa */}
                {gestionables.length > 0 && (
                  <div className="space-y-2 border-t border-slate-200 bg-white px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMoviendo(moviendo === g.clave ? null : g.clave)}
                        disabled={guardando}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900 disabled:opacity-50"
                      >
                        <CalendarClock size={13} />
                        {gestionables.length > 1 ? `Reprogramar los ${gestionables.length} trabajos` : 'Reprogramar el trabajo'}
                      </button>
                      <span className="text-[11px] text-slate-400">
                        Mueve los trabajos completos, con todos sus caballos, a otra fecha.
                      </span>
                    </div>

                    {moviendo === g.clave && (
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
                          onClick={() => moverTodo(g)}
                          disabled={guardando}
                          className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-400 disabled:opacity-50"
                        >
                          {guardando ? 'Moviendo…' : 'Mover a esa fecha'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setMoviendo(null)}
                          className="px-2 py-1.5 text-xs text-slate-500 transition-colors hover:text-slate-700"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}

                    {/* Editar / eliminar, por trabajo */}
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
              </>
            )}
          </section>
        )
      })}

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600">
          <AlertCircle size={13} /> {error}
        </div>
      )}
      {aviso && <p className="text-xs text-emerald-600">{aviso}</p>}

      <p className="text-[11px] text-slate-400">
        {enVuelo.length > 0
          ? 'Guardando…'
          : 'Realizado y no realizado se guardan solos. El reloj deja el trabajo pendiente para otra fecha.'}
      </p>

      {/* Una sola fecha para todo lo que quedó pendiente, sea de la empresa que sea */}
      {aReprogramar.length > 0 && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Nueva fecha</label>
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
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-400 disabled:opacity-50"
          >
            <CalendarPlus size={13} />
            {guardando ? 'Creando…' : 'Reprogramar'}
          </button>
          <button
            type="button"
            onClick={descartarPendientes}
            disabled={guardando}
            className="px-2 py-1.5 text-xs text-slate-500 transition-colors hover:text-slate-700 disabled:opacity-50"
          >
            Descartar
          </button>
          <p className="basis-full text-[11px] text-slate-500">
            {aReprogramar.length} casillero{aReprogramar.length !== 1 ? 's' : ''} marcado
            {aReprogramar.length !== 1 ? 's' : ''} como pendiente. Elegí la fecha a la que se pasan.
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
            onCambio()
          }}
        />
      )}
    </div>
  )
}
