import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, closestCorners,
  type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, arrayMove,
  sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDroppable } from '@dnd-kit/core'
import {
  ArrowLeft, GripVertical, Users, Plus, Trash2, MapPin, CheckCircle2, RotateCcw,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { torneoService } from '../../services/torneoService'
import { mensajeError } from '../../utils/error'
import { nombreCaballo } from '../../utils/caballo'
import {
  COLUMNA_DISPONIBLES, LABEL_ESTADO_TORNEO,
  type CaballoTorneo, type TableroTorneo, type TorneoJugador,
} from '../../types/torneo'
import Spinner from '../../components/ui/Spinner'

// =============================================================================
// Tablero kanban de asignación de caballos por jugador.
// =============================================================================
// Columna 1: caballos con tag "Jugador" disponibles (activos, de la sociedad y
// sin asignar en este torneo). Una columna más por cada jugador del torneo.
//
// Cada drop reescribe la columna destino entera vía `guardar_asignaciones_torneo`
// (y la de origen, para que el orden quede sin huecos). El estado local se
// actualiza antes de la llamada; si falla, se recarga el tablero del servidor.
//
// El orden de "Disponibles" no se persiste: esa columna se arma alfabéticamente
// en cada carga.
// =============================================================================

function ordenarPorNombre(caballos: CaballoTorneo[]): CaballoTorneo[] {
  return [...caballos].sort((a, b) => nombreCaballo(a).localeCompare(nombreCaballo(b)))
}

export default function TorneoKanbanPage() {
  const { id: torneoId } = useParams<{ id: string }>()
  const rol     = useAuthStore((s) => s.rol)
  const esAdmin = rol === 'admin'

  const [tablero,  setTablero]  = useState<TableroTorneo | null>(null)
  const [columnas, setColumnas] = useState<Record<string, CaballoTorneo[]>>({})
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [arrastrado, setArrastrado] = useState<CaballoTorneo | null>(null)
  const [nuevoJugador, setNuevoJugador] = useState('')

  // Columna donde arrancó el drag: onDragOver ya movió la tarjeta, así que al
  // soltar no se puede deducir del estado.
  const origenRef = useRef<string | null>(null)

  const cargar = useCallback(async () => {
    if (!torneoId) return
    setLoading(true)
    setError(null)
    try {
      const data = await torneoService.cargarTablero(torneoId)
      setTablero(data)
      setColumnas({
        [COLUMNA_DISPONIBLES]: ordenarPorNombre(data.disponibles),
        ...data.porJugador,
      })
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setLoading(false)
    }
  }, [torneoId])

  useEffect(() => { cargar() }, [cargar])

  const editable = esAdmin && tablero?.torneo.estado === 'activo'

  const sensors = useSensors(
    // Un umbral de 6px evita que un tap para hacer scroll arranque un drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function columnaDe(id: string): string | null {
    if (columnas[id]) return id
    return Object.keys(columnas).find((k) => columnas[k].some((c) => c.id === id)) ?? null
  }

  function handleDragStart(e: DragStartEvent) {
    const id = String(e.active.id)
    const col = columnaDe(id)
    origenRef.current = col
    setArrastrado(col ? columnas[col].find((c) => c.id === id) ?? null : null)
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e
    if (!over) return
    const origen  = columnaDe(String(active.id))
    const destino = columnaDe(String(over.id))
    if (!origen || !destino || origen === destino) return

    setColumnas((prev) => {
      const listaOrigen  = prev[origen]
      const listaDestino = prev[destino]
      const caballo = listaOrigen.find((c) => c.id === String(active.id))
      if (!caballo) return prev

      const indiceOver = listaDestino.findIndex((c) => c.id === String(over.id))
      const insertarEn = indiceOver >= 0 ? indiceOver : listaDestino.length

      return {
        ...prev,
        [origen]:  listaOrigen.filter((c) => c.id !== caballo.id),
        [destino]: [
          ...listaDestino.slice(0, insertarEn),
          caballo,
          ...listaDestino.slice(insertarEn),
        ],
      }
    })
  }

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setArrastrado(null)
    const origen = origenRef.current
    origenRef.current = null
    if (!over || !origen || !torneoId) return

    const caballoId = String(active.id)
    const destino   = columnaDe(String(over.id))
    if (!destino) return

    // Reordenamiento dentro de la misma columna.
    let listas = columnas
    if (destino === origen) {
      const lista = columnas[destino]
      const desde = lista.findIndex((c) => c.id === caballoId)
      const hasta = lista.findIndex((c) => c.id === String(over.id))
      if (desde < 0 || hasta < 0 || desde === hasta) return
      listas = { ...columnas, [destino]: arrayMove(lista, desde, hasta) }
      setColumnas(listas)
    }

    // "Disponibles" no guarda orden: se reordena alfabéticamente al soltar.
    if (destino === COLUMNA_DISPONIBLES) {
      listas = { ...listas, [destino]: ordenarPorNombre(listas[destino]) }
      setColumnas(listas)
    }

    setGuardando(true)
    setError(null)
    try {
      if (destino === COLUMNA_DISPONIBLES) {
        // Devolver a disponibles = soltar la asignación de ese caballo.
        await torneoService.guardarColumna(torneoId, null, [caballoId])
      } else {
        await torneoService.guardarColumna(
          torneoId, destino, listas[destino].map((c) => c.id),
        )
      }

      // La columna de origen quedó con un hueco en el orden: se reescribe.
      if (origen !== destino && origen !== COLUMNA_DISPONIBLES) {
        await torneoService.guardarColumna(
          torneoId, origen, listas[origen].map((c) => c.id),
        )
      }
    } catch (err) {
      setError(mensajeError(err))
      await cargar()
    } finally {
      setGuardando(false)
    }
  }

  async function handleAgregarJugador() {
    const nombre = nuevoJugador.trim()
    if (!nombre || !torneoId) return
    try {
      await torneoService.agregarJugadores(torneoId, [{ nombre }])
      setNuevoJugador('')
      await cargar()
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  async function handleQuitarJugador(jugador: TorneoJugador) {
    const asignados = columnas[jugador.id]?.length ?? 0
    const ok = window.confirm(
      asignados > 0
        ? `¿Sacar a ${jugador.nombre} del torneo? Sus ${asignados} caballo(s) vuelven a disponibles.`
        : `¿Sacar a ${jugador.nombre} del torneo?`,
    )
    if (!ok) return
    try {
      await torneoService.quitarJugador(jugador.id)
      await cargar()
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  async function handleCambiarEstado() {
    if (!tablero || !torneoId) return
    const finalizar = tablero.torneo.estado === 'activo'
    try {
      await torneoService.cambiarEstado(torneoId, finalizar ? 'finalizado' : 'activo')
      await cargar()
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  if (error && !tablero) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          Error: {error}
        </div>
      </div>
    )
  }

  if (!tablero) return null

  const { torneo, jugadores } = tablero

  return (
    <div className="p-4 md:p-6 pb-24">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/torneos"
            className="mb-1 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
          >
            <ArrowLeft size={13} />
            Torneos
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{torneo.nombre}</h1>
            {torneo.estado !== 'activo' && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                {LABEL_ESTADO_TORNEO[torneo.estado]}
              </span>
            )}
            {guardando && <span className="text-xs text-slate-400">Guardando…</span>}
          </div>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-400">
            {torneo.temporada ?? 'Sin temporada'} · {jugadores.length} jugador
            {jugadores.length === 1 ? '' : 'es'}
          </p>
        </div>

        {esAdmin && (
          <button
            onClick={handleCambiarEstado}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {torneo.estado === 'activo'
              ? <><CheckCircle2 size={15} /> Finalizar</>
              : <><RotateCcw size={15} /> Reabrir</>}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {!editable && (
        <p className="mb-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          {esAdmin
            ? 'El torneo está finalizado: la conformación queda como historial. Reabrilo para modificarla.'
            : 'Solo un administrador puede modificar la asignación de caballos.'}
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          <Columna
            id={COLUMNA_DISPONIBLES}
            titulo="Caballos disponibles"
            subtitulo="Con tag Jugador"
            caballos={columnas[COLUMNA_DISPONIBLES] ?? []}
            editable={editable}
            destacada
          />

          {jugadores.map((j) => (
            <Columna
              key={j.id}
              id={j.id}
              titulo={j.nombre}
              subtitulo={j.usuario_id ? 'Usuario del sistema' : undefined}
              caballos={columnas[j.id] ?? []}
              editable={editable}
              numerada
              onQuitar={esAdmin ? () => handleQuitarJugador(j) : undefined}
            />
          ))}

          {esAdmin && torneo.estado === 'activo' && (
            <div className="w-64 shrink-0 rounded-xl border border-dashed border-slate-200 p-3">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Agregar jugador
              </label>
              <input
                value={nuevoJugador}
                onChange={(e) => setNuevoJugador(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAgregarJugador() }}
                placeholder="Nombre"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              />
              <button
                onClick={handleAgregarJugador}
                className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                <Plus size={15} />
                Agregar
              </button>
            </div>
          )}
        </div>

        <DragOverlay>
          {arrastrado && <TarjetaContenido caballo={arrastrado} arrastrando />}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

function Columna({
  id, titulo, subtitulo, caballos, editable, destacada, numerada, onQuitar,
}: {
  id: string
  titulo: string
  subtitulo?: string
  caballos: CaballoTorneo[]
  editable: boolean
  destacada?: boolean
  numerada?: boolean
  onQuitar?: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      className={`w-64 shrink-0 rounded-xl border p-3 transition-colors ${
        isOver ? 'border-brand-300 bg-brand-50/40' : 'border-slate-100 bg-slate-50/60'
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-800">
            {destacada && <Users size={14} className="shrink-0 text-slate-400" />}
            {titulo}
          </h2>
          <p className="text-[11px] text-slate-400">
            {subtitulo ? `${subtitulo} · ` : ''}{caballos.length} caballo{caballos.length === 1 ? '' : 's'}
          </p>
        </div>
        {onQuitar && (
          <button
            onClick={onQuitar}
            title="Sacar jugador del torneo"
            className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <SortableContext
        id={id}
        items={caballos.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div ref={setNodeRef} className="min-h-24 space-y-2">
          {caballos.map((caballo, i) => (
            <TarjetaCaballo
              key={caballo.id}
              caballo={caballo}
              editable={editable}
              numero={numerada ? i + 1 : undefined}
            />
          ))}
          {caballos.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-[11px] text-slate-300">
              Soltá caballos acá
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

function TarjetaCaballo({
  caballo, editable, numero,
}: {
  caballo: CaballoTorneo
  editable: boolean
  numero?: number
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: caballo.id, disabled: !editable })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'opacity-40' : ''}
      {...attributes}
      {...(editable ? listeners : {})}
    >
      <TarjetaContenido caballo={caballo} numero={numero} editable={editable} />
    </div>
  )
}

function TarjetaContenido({
  caballo, numero, editable, arrastrando,
}: {
  caballo: CaballoTorneo
  numero?: number
  editable?: boolean
  arrastrando?: boolean
}) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border bg-white p-2.5 ${
        arrastrando ? 'border-brand-300 shadow-lg' : 'border-slate-200'
      } ${editable ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      {editable && <GripVertical size={14} className="mt-0.5 shrink-0 text-slate-300" />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">
          {numero !== undefined && <span className="mr-1 text-slate-400">{numero}.</span>}
          {nombreCaballo(caballo)}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
          {caballo.pelaje && <span>{caballo.pelaje}</span>}
          {caballo.campo && (
            <span className="flex items-center gap-0.5">
              <MapPin size={10} />
              {caballo.campo}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
