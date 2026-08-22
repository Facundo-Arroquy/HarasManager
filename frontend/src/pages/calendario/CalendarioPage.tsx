import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Syringe, Stethoscope, X, Building2, Pencil, Trash2 } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { sanidadService } from '../../services/sanidadService'
import { historialService, type ConsultaCalendario } from '../../services/historialService'
import { empresaService } from '../../services/empresaService'
import { type TrabajoSanitario } from '../../types/sanidad'
import { diaAR, hoyAR } from '../../utils/fecha'
import { mensajeError } from '../../utils/error'
import Spinner from '../../components/ui/Spinner'
import NuevaConsultaModal from '../../components/domain/NuevaConsultaModal'
import TrabajosDelDia from '../../components/domain/TrabajosDelDia'
import type { HistorialEntry } from '../../components/domain/HistorialCard'

// ── Utilidades de fecha ───────────────────────────────────────────────────────

/** ISO local, sin el shift a UTC que mete `toISOString()`. */
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function primerDiaMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function fechaDesdeISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Días de la grilla del mes, arrancando el lunes de la primera semana. */
function grillaMes(mes: Date): Date[] {
  const primero = primerDiaMes(mes)
  const dow     = primero.getDay()             // 0 = domingo
  const offset  = dow === 0 ? 6 : dow - 1      // lunes como primera columna
  const inicio  = new Date(primero)
  inicio.setDate(inicio.getDate() - offset)

  const diasMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
  const celdas  = Math.ceil((offset + diasMes) / 7) * 7

  return Array.from({ length: celdas }, (_, i) => {
    const d = new Date(inicio)
    d.setDate(d.getDate() + i)
    return d
  })
}

const DIAS_SEMANA = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM']

/** Píxeles de recorrido horizontal a partir de los cuales es un deslizamiento y no un toque. */
const DESLIZ_MINIMO = 50

function tituloMes(d: Date): string {
  return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

function tituloDia(iso: string): string {
  return fechaDesdeISO(iso).toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

function horaAR(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires',
  })
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function CalendarioPage() {
  const navigate   = useNavigate()
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const userId     = useAuthStore((s) => s.user?.id)
  const rol        = useAuthStore((s) => s.rol)
  const esVet      = rol === 'veterinario'

  const hoy = hoyAR()

  const [mesRef,   setMesRef]   = useState(() => primerDiaMes(fechaDesdeISO(hoy)))
  const [diaSelec, setDiaSelec] = useState(hoy)

  const [trabajos,  setTrabajos]  = useState<TrabajoSanitario[]>([])
  const [consultas, setConsultas] = useState<ConsultaCalendario[]>([])
  // Solo para el vet: trabaja con varias empresas y necesita saber de cuál
  // viene cada cosa. El admin ve una sola, mostrárselo sería ruido.
  const [empresas,  setEmpresas]  = useState<Map<string, string>>(new Map())
  const [loading,   setLoading]   = useState(true)
  // Solo la primera carga tapa la lista: en las recargas el detalle abierto de un
  // plan tiene que seguir montado, con lo que el usuario esté completando.
  const [primeraCarga, setPrimeraCarga] = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  const [reagendando, setReagendando] = useState<ConsultaCalendario | null>(null)
  const [completando, setCompletando] = useState<(HistorialEntry & { caballo_id: string }) | null>(null)
  // Corregir una agendada sin darla por hecha: mismo modal, otra intención.
  const [editando,    setEditando]    = useState<(HistorialEntry & { caballo_id: string }) | null>(null)
  const [borrandoId,  setBorrandoId]  = useState<string | null>(null)
  const [abriendoId,  setAbriendoId]  = useState<string | null>(null)
  const [recarga,     setRecarga]     = useState(0)

  const dias = useMemo(() => grillaMes(mesRef), [mesRef])

  // Los planes se traen una sola vez: la lista completa ya viene con su fecha.
  useEffect(() => {
    if (!esVet && !sociedadId) return
    let vigente = true
    ;(esVet ? sanidadService.listarTrabajosVet() : sanidadService.listarTrabajos(sociedadId!))
      .then((t) => { if (vigente) setTrabajos(t) })
      .catch((e) => { if (vigente) setError(mensajeError(e)) })
    return () => { vigente = false }
  }, [sociedadId, esVet, recarga])

  // También para el admin: los trabajos del día se agrupan por empresa y el
  // encabezado de cada grupo necesita el nombre, no solo el id.
  useEffect(() => {
    empresaService.mapaNombres().then(setEmpresas).catch(() => {})
  }, [])

  // Las consultas sí se piden por mes visible, con un día de margen a cada lado:
  // `fecha_consulta` es TIMESTAMPTZ y el corte por día se hace en hora argentina.
  useEffect(() => {
    if (!esVet && !sociedadId) return
    let vigente = true
    const desde = new Date(dias[0]);               desde.setDate(desde.getDate() - 1)
    const hasta = new Date(dias[dias.length - 1]); hasta.setDate(hasta.getDate() + 1)

    setLoading(true)
    historialService.listarPorRango(toISO(desde), toISO(hasta), esVet ? undefined : sociedadId)
      .then((c) => { if (vigente) { setConsultas(c); setError(null) } })
      .catch((e) => { if (vigente) setError(mensajeError(e)) })
      .finally(() => { if (vigente) { setLoading(false); setPrimeraCarga(false) } })
    return () => { vigente = false }
  }, [sociedadId, esVet, dias, recarga])

  // ── Agrupación por día ─────────────────────────────────────────────────────

  const trabajosPorDia = useMemo(() => {
    const mapa: Record<string, TrabajoSanitario[]> = {}
    for (const t of trabajos) (mapa[t.fecha_programada] ??= []).push(t)
    return mapa
  }, [trabajos])

  const consultasPorDia = useMemo(() => {
    const mapa: Record<string, ConsultaCalendario[]> = {}
    for (const c of consultas) (mapa[diaAR(c.fecha_consulta)] ??= []).push(c)
    return mapa
  }, [consultas])

  const trabajosDia  = useMemo(() => trabajosPorDia[diaSelec] ?? [], [trabajosPorDia, diaSelec])
  const consultasDia = consultasPorDia[diaSelec] ?? []
  const esHoySelec   = diaSelec === hoy

  function cambiarMes(delta: number) {
    setMesRef((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }

  // ── Deslizar de costado para cambiar de mes ────────────────────────────────
  // No se llama a `preventDefault()` en ningún momento: el scroll vertical de la
  // página sigue siendo el nativo y bajar a los trabajos del día no cambia el mes.

  /** Punto donde arrancó el dedo, y si ya se pasó el umbral horizontal. */
  const gesto = useRef<{ x: number; y: number; deslizo: boolean } | null>(null)

  function tocarInicio(e: React.TouchEvent) {
    const t = e.touches[0]
    gesto.current = { x: t.clientX, y: t.clientY, deslizo: false }
  }

  function tocarMover(e: React.TouchEvent) {
    const g = gesto.current
    if (!g || g.deslizo) return
    const t  = e.touches[0]
    const dx = t.clientX - g.x
    const dy = t.clientY - g.y
    // Horizontal y más largo que lo vertical: si el dedo bajó, es scroll.
    if (Math.abs(dx) > DESLIZ_MINIMO && Math.abs(dx) > Math.abs(dy)) g.deslizo = true
  }

  function tocarFin(e: React.TouchEvent) {
    const g = gesto.current
    if (!g?.deslizo) return
    // Izquierda = mes siguiente, como pasar una hoja.
    cambiarMes(e.changedTouches[0].clientX < g.x ? 1 : -1)
  }

  /**
   * El día que quedó abajo del dedo no se selecciona al soltar. La marca se
   * limpia en el toque siguiente, así el tap normal sigue funcionando.
   */
  function esDesliz(): boolean {
    return gesto.current?.deslizo ?? false
  }

  function irAHoy() {
    setMesRef(primerDiaMes(fechaDesdeISO(hoy)))
    setDiaSelec(hoy)
  }

  /**
   * Pendiente → se abre la ficha para completarla. Realizada → se va al
   * historial del caballo con esa consulta abierta.
   */
  async function abrirConsulta(c: ConsultaCalendario) {
    if (c.estado === 'realizada') {
      navigate(`/caballos/${c.caballo_id}/historial?consulta=${c.id}`)
      return
    }
    setAbriendoId(c.id)
    try {
      const entry = await historialService.obtenerPorId(c.id)
      setCompletando(entry as unknown as HistorialEntry & { caballo_id: string })
    } catch (e) {
      setError(mensajeError(e, 'No se pudo abrir la consulta.'))
    } finally {
      setAbriendoId(null)
    }
  }

  /** Corregir los datos de una consulta agendada, sin marcarla como hecha. */
  async function editarConsulta(c: ConsultaCalendario) {
    setAbriendoId(c.id)
    try {
      const entry = await historialService.obtenerPorId(c.id)
      setEditando(entry as unknown as HistorialEntry & { caballo_id: string })
    } catch (e) {
      setError(mensajeError(e, 'No se pudo abrir la consulta.'))
    } finally {
      setAbriendoId(null)
    }
  }

  /** Solo para las agendadas: una consulta ya hecha es historial y no se borra. */
  async function eliminarConsulta(c: ConsultaCalendario) {
    const ok = window.confirm(
      `¿Eliminar la consulta agendada de ${c.caballo_nombre} (${c.tipo})?\n\nNo se puede deshacer.`,
    )
    if (!ok) return
    setBorrandoId(c.id)
    try {
      await historialService.eliminar(c.id)
      setRecarga((n) => n + 1)
    } catch (e) {
      setError(mensajeError(e, 'No se pudo eliminar la consulta.'))
    } finally {
      setBorrandoId(null)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto pb-24 space-y-6">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Calendario</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Trabajos programados y consultas realizadas
          </p>
        </div>
        <button
          onClick={irAHoy}
          disabled={esHoySelec && toISO(primerDiaMes(fechaDesdeISO(hoy))) === toISO(mesRef)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900 disabled:opacity-40"
        >
          Hoy
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          Error: {error}
        </div>
      )}

      {/* Calendario mensual. No va fijo: los trabajos del día son tablas largas y
          el mes pegado arriba se comía media pantalla al scrollearlas. */}
      <section>
        <div
          onTouchStart={tocarInicio}
          onTouchMove={tocarMover}
          onTouchEnd={tocarFin}
          // `pan-y`: el dedo en vertical scrollea la página, en horizontal cambia el mes.
          className="touch-pan-y rounded-xl border border-slate-200 bg-white p-3 sm:p-4"
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <button
              onClick={() => cambiarMes(-1)}
              className="rounded-lg border border-slate-300 p-1.5 text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-900"
              aria-label="Mes anterior"
            >
              <ChevronLeft size={15} />
            </button>
            <h2 className="text-sm font-semibold text-slate-900 first-letter:uppercase">
              {tituloMes(mesRef)}
            </h2>
            <button
              onClick={() => cambiarMes(1)}
              className="rounded-lg border border-slate-300 p-1.5 text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-900"
              aria-label="Mes siguiente"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="pb-1 text-center text-[10px] font-semibold text-slate-400">
                {d}
              </div>
            ))}

            {dias.map((dia) => {
              const iso        = toISO(dia)
              const delMes     = dia.getMonth() === mesRef.getMonth()
              const esHoy      = iso === hoy
              const esSelec    = iso === diaSelec
              // Se cuenta cada trabajo suelto, que es una fila de la tabla del día.
              const nTrabajos  = (trabajosPorDia[iso] ?? []).length
              const nConsultas = (consultasPorDia[iso] ?? []).length

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => { if (!esDesliz()) setDiaSelec(iso) }}
                  className={`flex min-h-[3.25rem] sm:min-h-[4rem] flex-col items-center rounded-lg border p-1 transition-colors ${
                    esSelec
                      ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500/30'
                      : 'border-slate-200 hover:border-slate-300'
                  } ${delMes ? '' : 'opacity-40'}`}
                >
                  <span className={`text-xs ${esHoy ? 'font-bold text-brand-600' : 'text-slate-600'}`}>
                    {dia.getDate()}
                  </span>
                  <span className="mt-auto flex w-full flex-col gap-0.5">
                    {nTrabajos > 0 && (
                      <span className="rounded bg-brand-100 px-1 py-0.5 text-[10px] font-medium text-brand-700">
                        {nTrabajos} trabajo{nTrabajos !== 1 ? 's' : ''}
                      </span>
                    )}
                    {nConsultas > 0 && (
                      <span className="rounded bg-blue-100 px-1 py-0.5 text-[10px] font-medium text-blue-700">
                        {nConsultas} cons.
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>

          <p className="mt-2 text-center text-[10px] text-slate-300 sm:hidden">
            Deslizá de costado para cambiar de mes
          </p>
        </div>
      </section>

      {/* Trabajos del día — todos juntos en una tabla, sin desplegables */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Syringe size={16} className={esHoySelec ? 'text-brand-600' : 'text-slate-400'} />
            <h2 className="text-sm font-semibold text-slate-900 truncate">
              {esHoySelec ? 'Trabajos de hoy' : 'Trabajos del día'}
            </h2>
            <span className="text-xs text-slate-400 first-letter:uppercase hidden sm:inline">
              · {tituloDia(diaSelec)}
            </span>
          </div>
          <span className="shrink-0 text-xs text-slate-500">
            {trabajosDia.length} trabajo{trabajosDia.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading && primeraCarga ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : (
          <TrabajosDelDia
            trabajos={trabajosDia}
            esVet={esVet}
            empresas={empresas}
            onCambio={() => setRecarga((n) => n + 1)}
          />
        )}
      </section>

      {/* Consultas del día */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Stethoscope size={16} className={esHoySelec ? 'text-blue-500' : 'text-slate-400'} />
            <h2 className="text-sm font-semibold text-slate-900 truncate">
              {esHoySelec ? 'Consultas de hoy' : 'Consultas del día'}
            </h2>
          </div>
          <span className="shrink-0 text-xs text-slate-500">
            {consultasDia.length} consulta{consultasDia.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading && primeraCarga ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : consultasDia.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            Sin consultas para este día.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {consultasDia.map((c) => (
              <div key={c.id} className="group flex items-start gap-3 px-4 py-3 text-sm hover:bg-slate-50">
                <Stethoscope size={14} className="mt-0.5 shrink-0 text-blue-500" />
                <button
                  type="button"
                  onClick={() => abrirConsulta(c)}
                  disabled={abriendoId === c.id}
                  className="flex-1 min-w-0 text-left disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-900 group-hover:text-brand-600">
                      {c.caballo_nombre}
                    </span>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                      {c.tipo}
                    </span>
                    {esVet && c.sociedad_id && empresas.get(c.sociedad_id) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                        <Building2 size={10} /> {empresas.get(c.sociedad_id)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-slate-400">
                    <span>{horaAR(c.fecha_consulta)}</span>
                    {c.veterinario && (
                      <span>· {c.creado_por === userId ? 'Vos' : c.veterinario}</span>
                    )}
                    {c.diagnostico && <span>· {c.diagnostico}</span>}
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    c.estado === 'pendiente'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {c.estado === 'pendiente' ? 'Pendiente' : 'Realizada'}
                  </span>
                  {/* Una consulta ya hecha no se toca: su ficha es historial clínico. */}
                  {c.estado === 'pendiente' && c.creado_por === userId && (
                    <>
                      <button
                        type="button"
                        onClick={() => setReagendando(c)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700"
                        title="Cambiar fecha y horario"
                      >
                        Reagendar
                      </button>
                      <button
                        type="button"
                        onClick={() => editarConsulta(c)}
                        disabled={abriendoId === c.id}
                        className="rounded-md border border-slate-300 p-1 text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700 disabled:opacity-50"
                        title="Editar la consulta agendada"
                        aria-label="Editar la consulta agendada"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => eliminarConsulta(c)}
                        disabled={borrandoId === c.id}
                        className="rounded-md border border-slate-300 p-1 text-slate-500 transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                        title="Eliminar la consulta agendada"
                        aria-label="Eliminar la consulta agendada"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                  <ChevronRight size={15} className="text-slate-300 group-hover:text-brand-500" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {reagendando && (
        <ReagendarModal
          consulta={reagendando}
          onClose={() => setReagendando(null)}
          onSuccess={() => { setReagendando(null); setRecarga((n) => n + 1) }}
        />
      )}

      {completando && (
        <NuevaConsultaModal
          caballoId={completando.caballo_id}
          entryToEdit={completando}
          onClose={() => setCompletando(null)}
          onSuccess={() => { setCompletando(null); setRecarga((n) => n + 1) }}
        />
      )}

      {editando && (
        <NuevaConsultaModal
          caballoId={editando.caballo_id}
          entryToEdit={editando}
          soloEditar
          onClose={() => setEditando(null)}
          onSuccess={() => { setEditando(null); setRecarga((n) => n + 1) }}
        />
      )}
    </div>
  )
}

// ── Modal: mover una consulta a otra fecha y horario ─────────────────────────

function ReagendarModal({
  consulta, onClose, onSuccess,
}: {
  consulta: ConsultaCalendario
  onClose: () => void
  onSuccess: () => void
}) {
  // `datetime-local` trabaja en hora local: se pasa el instante a local restando
  // el offset, y al guardar se vuelve a ISO.
  const [valor, setValor] = useState(() => {
    const d = new Date(consulta.fecha_consulta)
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function guardar() {
    if (!valor) return setError('Elegí la nueva fecha y horario.')
    setSaving(true)
    setError('')
    try {
      await historialService.reagendar(consulta.id, new Date(valor).toISOString())
      onSuccess()
    } catch (e) {
      setError(mensajeError(e, 'No se pudo reagendar.'))
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm sm:mx-4 rounded-t-2xl sm:rounded-xl border border-slate-300 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Reagendar consulta</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {consulta.caballo_nombre} · {consulta.tipo}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-2">
          <label className="text-xs font-medium text-slate-500">Nueva fecha y horario</label>
          <input
            type="datetime-local"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-md bg-brand-500 hover:bg-brand-400 text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Reagendar'}
          </button>
        </div>
      </div>
    </div>
  )
}
