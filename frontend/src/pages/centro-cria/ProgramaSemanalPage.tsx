import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Check, Clock, AlertCircle, X } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useCrianzaStore } from '../../store/crianzaStore'
import Spinner from '../../components/ui/Spinner'
import RegistroCriaModal from '../../components/centro-cria/RegistroCriaModal'
import FlushingModal from '../../components/centro-cria/FlushingModal'
import EcografiaModal from '../../components/centro-cria/EcografiaModal'
import FlushingBanner from '../../components/centro-cria/FlushingBanner'
import NombreCaballoLink from '../../components/domain/NombreCaballoLink'
import FiltroColumna from '../../components/ui/FiltroColumna'
import { useFiltrosTabla } from '../../hooks/useFiltrosTabla'
import { hoyAR, sumarDias } from '../../utils/fecha'
import { accionParaRecordatorio, type AccionRecordatorio } from '../../utils/recordatorio'
import { LABEL_RESULTADO_ECO } from '../../types/crianza'
import type { RolReproductivo, RecordatorioCria } from '../../types/crianza'

// ── Utilidades de fecha ───────────────────────────────────────────────────────

/**
 * El 'YYYY-MM-DD' de `hoyAR()` como Date local. La semana se arma desde acá y no
 * desde `new Date()`: fuera de Argentina el reloj local puede estar en otro día
 * y el calendario mostraba una semana distinta a la de "hoy".
 */
function fechaLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function inicioSemana(ref: Date): Date {
  const d = new Date(ref)
  const dow = d.getDay() // 0=Dom
  const diff = dow === 0 ? -6 : 1 - dow // lunes como inicio
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** ISO local, sin el shift a UTC que mete `toISOString()`. */
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function semana(inicio: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio)
    d.setDate(d.getDate() + i)
    return d
  })
}

const DIAS = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM']

function formatDia(d: Date): string {
  const dia = DIAS[d.getDay() === 0 ? 6 : d.getDay() - 1]
  return `${dia} ${String(d.getDate()).padStart(2, '0')}`
}

/** "Semana del 3 al 9 de agosto 2026", contemplando semanas a caballo de dos meses. */
function rangoSemana(inicio: Date): string {
  const fin = new Date(inicio)
  fin.setDate(fin.getDate() + 6)
  const mesIni = inicio.toLocaleDateString('es-AR', { month: 'long' })
  const mesFin = fin.toLocaleDateString('es-AR', { month: 'long' })
  if (mesIni === mesFin && inicio.getFullYear() === fin.getFullYear()) {
    return `Semana del ${inicio.getDate()} al ${fin.getDate()} de ${mesIni} ${fin.getFullYear()}`
  }
  return `Semana del ${inicio.getDate()} de ${mesIni} al ${fin.getDate()} de ${mesFin} ${fin.getFullYear()}`
}

function formatDiaLargo(d: Date): string {
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ── Eventos del programa ──────────────────────────────────────────────────────

/**
 * Los tres orígenes de actividad del centro (recordatorios, registros clínicos y
 * transferencias) se normalizan a un mismo `Evento` para poder pintarlos juntos
 * en el calendario y listarlos en la tabla del día.
 */
type TipoEvento =
  | 'vencido' | 'pendiente'
  | 'registro' | 'transferencia' | 'flushing' | 'ecografia'

interface Evento {
  id:            string
  fecha:         string
  caballoId:     string
  caballoNombre: string
  rol:           RolReproductivo
  etiqueta:      string
  tipo:          TipoEvento
  veterinario:   string | null
  detalle:       string | null
  /**
   * Solo en los eventos que todavía hay que hacer. Es lo que convierte el clic
   * en "hacer lo agendado" y no en "cargar un registro nuevo": sin esto el
   * recordatorio quedaba pendiente al lado del registro que lo resolvió.
   */
  recordatorio?: RecordatorioCria
}

const ESTILO_EVENTO: Record<TipoEvento, string> = {
  vencido:       'bg-red-50 border-red-200 text-red-900',
  pendiente:     'bg-green-50 border-green-200 text-green-900',
  registro:      'bg-blue-50 border-blue-200 text-blue-900',
  transferencia: 'bg-purple-50 border-purple-200 text-purple-900',
  flushing:      'bg-teal-50 border-teal-200 text-teal-900',
  ecografia:     'bg-indigo-50 border-indigo-200 text-indigo-900',
}

const ESTILO_BADGE: Record<TipoEvento, string> = {
  vencido:       'bg-red-100 text-red-700',
  pendiente:     'bg-green-100 text-green-700',
  registro:      'bg-blue-100 text-blue-700',
  transferencia: 'bg-purple-100 text-purple-700',
  flushing:      'bg-teal-100 text-teal-700',
  ecografia:     'bg-indigo-100 text-indigo-700',
}

/**
 * Los labels se leen en binario a propósito: lo único que hay que poder decir
 * de un vistazo es si eso ya se hizo o todavía falta. El ícono lo remata —
 * reloj y alerta se tocan, el tilde no abre nada.
 */
const LABEL_ESTADO_EVENTO: Record<TipoEvento, string> = {
  vencido:       'Vencido',
  pendiente:     'Falta hacer',
  registro:      'Registrado',
  transferencia: 'Transferida',
  flushing:      'Realizado',
  ecografia:     'Realizado',
}

const ICONO_ESTADO_EVENTO: Record<TipoEvento, typeof Check> = {
  vencido:       AlertCircle,
  pendiente:     Clock,
  registro:      Check,
  transferencia: Check,
  flushing:      Check,
  ecografia:     Check,
}

/** Lo que filtra y ordena cada columna de la tabla del día (filtros tipo Excel). */
const COLUMNAS_TABLA = {
  caballo:     (e: Evento) => e.caballoNombre,
  rol:         (e: Evento) => e.rol,
  tipo:        (e: Evento) => e.etiqueta,
  veterinario: (e: Evento) => e.veterinario,
  estado:      (e: Evento) => LABEL_ESTADO_EVENTO[e.tipo],
  detalle:     (e: Evento) => e.detalle,
}

const ENCABEZADOS: { col: keyof typeof COLUMNAS_TABLA; titulo: string }[] = [
  { col: 'caballo',     titulo: 'Caballo' },
  { col: 'rol',         titulo: 'Rol' },
  { col: 'tipo',        titulo: 'Tipo' },
  { col: 'veterinario', titulo: 'Veterinario' },
  { col: 'estado',      titulo: 'Estado' },
  { col: 'detalle',     titulo: 'Detalle' },
]

function nombreVet(v?: { nombre: string; apellido: string } | null): string | null {
  return v ? `Dr/a. ${v.nombre} ${v.apellido}`.trim() : null
}

/** Los modales del calendario: los del recordatorio, más el alta desde cero. */
type Accion = AccionRecordatorio | { modal: 'registro'; recordatorio?: undefined }

// ── Componente principal ──────────────────────────────────────────────────────

export default function ProgramaSemanalPage() {
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const rol        = useAuthStore((s) => s.rol)
  const esVet      = rol === 'veterinario'
  const {
    registros, recordatorios, transferencias, ecografias, flushings,
    cargar, cargarParaVet, loading,
  } = useCrianzaStore()

  const hoy = hoyAR()

  const [inicioRef, setInicioRef] = useState(() => inicioSemana(fechaLocal(hoy)))
  const [diaSelec,  setDiaSelec]  = useState(hoy)
  const [accion,    setAccion]    = useState<Accion | null>(null)
  const [avisoEco,  setAvisoEco]  = useState('')

  const dias = useMemo(() => semana(inicioRef), [inicioRef])

  // Se recarga siempre al entrar, como el resto del centro: con el viejo
  // "solo si está vacío" quedaban los datos de otra sociedad al cambiar de
  // establecimiento, o lo que se había cargado desde otra pantalla.
  useEffect(() => {
    if (sociedadId) cargar(sociedadId)
    else if (esVet) cargarParaVet()
  }, [sociedadId, esVet]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Cambiar de semana lleva también el día de la tabla, al mismo día de la semana. */
  function moverSemana(dias: number) {
    const d = new Date(inicioRef)
    d.setDate(d.getDate() + dias)
    setInicioRef(d)
    setDiaSelec((prev) => sumarDias(prev, dias))
  }

  const semanaAnterior  = () => moverSemana(-7)
  const semanaSiguiente = () => moverSemana(7)

  function recargar() {
    if (sociedadId) cargar(sociedadId)
    else if (esVet) cargarParaVet()
  }

  /**
   * Tocar un evento del calendario. Lo que ya pasó (un registro cargado, una
   * transferencia hecha) no se vuelve a cargar: solo se abre el día para verlo
   * en la tabla de abajo. Lo que está agendado abre el modal que corresponde,
   * enganchado al recordatorio, así queda hecho en vez de duplicarse.
   */
  function abrirEvento(e: Evento) {
    setAvisoEco('')
    setDiaSelec(e.fecha)
    if (!esVet || !e.recordatorio) return

    const accionRec = accionParaRecordatorio(e.recordatorio, transferencias)
    if (accionRec.modal === 'falta-transferencia') {
      setAvisoEco(
        `No se encontró la transferencia de ${e.caballoNombre} para cargar la ${e.recordatorio.tipo}.`,
      )
      return
    }
    setAccion(accionRec)
  }

  // ── Normalización de los tres orígenes a una lista única de eventos ─────────
  const eventos = useMemo<Evento[]>(() => {
    const out: Evento[] = []

    for (const r of recordatorios) {
      if (r.estado !== 'pendiente' && r.estado !== 'vencido') continue
      out.push({
        id:            `rec-${r.id}`,
        fecha:         r.fecha_vto,
        caballoId:     r.caballo_id,
        caballoNombre: r.caballo?.nombre ?? '—',
        rol:           r.caballo?.rol_reproductivo ?? null,
        etiqueta:      r.tipo,
        tipo:          r.estado === 'vencido' ? 'vencido' : 'pendiente',
        veterinario:   nombreVet(r.veterinario),
        detalle:       r.notas,
        recordatorio:  r,
      })
    }

    for (const r of registros) {
      const ovarios = [
        r.ovario_izq.length ? `OI: ${r.ovario_izq.join(', ')}` : null,
        r.ovario_der.length ? `OD: ${r.ovario_der.join(', ')}` : null,
        r.utero.length      ? `Út: ${r.utero.join(', ')}`      : null,
      ].filter(Boolean).join(' · ')
      out.push({
        id:            `reg-${r.id}`,
        fecha:         r.fecha,
        caballoId:     r.caballo_id,
        caballoNombre: r.caballo?.nombre ?? '—',
        rol:           r.caballo?.rol_reproductivo ?? null,
        etiqueta:      r.obs_chips.length > 0 ? r.obs_chips.join(', ') : 'Revisión',
        tipo:          'registro',
        veterinario:   nombreVet(r.veterinario),
        detalle:       ovarios || null,
      })
    }

    // El flushing hecho es lo que reemplaza al recordatorio que lo pedía: sin
    // esta vuelta, hacer el flushing hacía desaparecer a la donante del día.
    for (const f of flushings) {
      if (f.cancelado) continue
      const resultado = f.es_negativo
        ? 'sin embriones'
        : `${f.cantidad ?? 0} embri${f.cantidad === 1 ? 'ón' : 'ones'}`
      out.push({
        id:            `flu-${f.id}`,
        fecha:         f.fecha,
        caballoId:     f.caballo_id,
        caballoNombre: f.caballo?.nombre ?? '—',
        rol:           'Donante',
        etiqueta:      `Flushing: ${resultado}`,
        tipo:          'flushing',
        veterinario:   nombreVet(f.veterinario),
        detalle:       [f.pg_given ? 'Se dio PG' : null, f.notas].filter(Boolean).join(' · ') || null,
      })
    }

    // Ídem las ecografías: cierran un recordatorio 'Eco 1/2/3' y hasta ahora no
    // se veían en ningún lado del programa.
    for (const e of ecografias) {
      out.push({
        id:            `eco-${e.id}`,
        fecha:         e.fecha,
        caballoId:     e.caballo_receptora_id,
        caballoNombre: e.receptora?.nombre ?? '—',
        rol:           'Receptora',
        etiqueta:      `Eco ${e.numero}: ${LABEL_RESULTADO_ECO[e.resultado]}`,
        tipo:          'ecografia',
        veterinario:   nombreVet(e.veterinario),
        detalle:       e.notas,
      })
    }

    for (const t of transferencias) {
      out.push({
        id:            `tra-${t.id}`,
        fecha:         t.fecha,
        caballoId:     t.caballo_receptora_id,
        caballoNombre: t.receptora?.nombre ?? '—',
        // La transferencia siempre se le hace a la receptora.
        rol:           'Receptora',
        etiqueta:      'Transferencia',
        tipo:          'transferencia',
        veterinario:   nombreVet(t.veterinario),
        detalle:       t.donante?.nombre ? `Donante: ${t.donante.nombre}` : null,
      })
    }

    return out
  }, [registros, recordatorios, transferencias, flushings, ecografias])

  const eventosPorDia = useMemo(() => {
    const mapa: Record<string, Evento[]> = {}
    for (const e of eventos) (mapa[e.fecha] ??= []).push(e)
    return mapa
  }, [eventos])

  // ── Métricas de la semana en pantalla ──────────────────────────────────────
  const resumen = useMemo(() => {
    const isoSemana = new Set(dias.map(toISO))
    const deLaSemana = eventos.filter((e) => isoSemana.has(e.fecha))
    return {
      vencidos:       deLaSemana.filter((e) => e.tipo === 'vencido').length,
      hoy:            eventos.filter((e) => e.fecha === hoy).length,
      programados:    deLaSemana.filter((e) => e.tipo === 'pendiente').length,
      transferencias: deLaSemana.filter((e) => e.tipo === 'transferencia').length,
    }
  }, [eventos, dias, hoy])

  const eventosDia = eventosPorDia[diaSelec] ?? []
  // Los filtros quedan puestos al cambiar de día, como en una planilla.
  const filtros = useFiltrosTabla(eventosDia, COLUMNAS_TABLA)

  if (loading && registros.length === 0) {
    return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Programa semanal</h1>
          <p className="text-sm text-slate-500 mt-0.5 first-letter:uppercase">{rangoSemana(inicioRef)}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={semanaAnterior}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900"
          >
            <ChevronLeft size={15} />
            <span className="hidden sm:inline">Semana anterior</span>
          </button>
          <button
            onClick={() => { setInicioRef(inicioSemana(fechaLocal(hoy))); setDiaSelec(hoy) }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900"
          >
            Hoy
          </button>
          <button
            onClick={semanaSiguiente}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900"
          >
            <span className="hidden sm:inline">Semana siguiente</span>
            <ChevronRight size={15} />
          </button>
          {esVet && (
            <button
              onClick={() => setAccion({ modal: 'registro' })}
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">Nuevo registro</span>
            </button>
          )}
        </div>
      </div>

      {/* Flushings del día — solo aparece si hay alguno para hoy */}
      <FlushingBanner />

      {/* Resumen de la semana */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Tile valor={resumen.vencidos}       label="Vencidos"       color="text-red-600" />
        <Tile valor={resumen.hoy}            label="Hoy"            color="text-orange-500" />
        <Tile valor={resumen.programados}    label="Falta hacer"    color="text-green-600" />
        <Tile valor={resumen.transferencias} label="Transferencias" color="text-blue-600" />
      </div>

      {/* Calendario semanal — scroll horizontal en pantallas chicas */}
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <div className="grid grid-cols-7 gap-3 min-w-[1000px]">
          {dias.map((dia) => {
            const iso     = toISO(dia)
            const esHoy   = iso === hoy
            const esSelec = iso === diaSelec
            const delDia  = eventosPorDia[iso] ?? []
            const donantes   = delDia.filter((e) => e.rol === 'Donante')
            const receptoras = delDia.filter((e) => e.rol === 'Receptora')
            // Sin rol reproductivo cargado: se muestran aparte para no perderlos.
            const otros      = delDia.filter((e) => e.rol !== 'Donante' && e.rol !== 'Receptora')

            return (
              <div
                key={iso}
                onClick={() => setDiaSelec(iso)}
                className={`cursor-pointer rounded-xl border bg-white p-3 transition-colors ${
                  esSelec
                    ? 'border-brand-500 ring-2 ring-brand-500/30'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <h3 className={`mb-3 text-sm font-bold ${esHoy ? 'text-brand-600' : 'text-slate-900'}`}>
                  {formatDia(dia)}
                </h3>

                {delDia.length === 0 ? (
                  <div className="rounded-lg bg-slate-100 p-2 text-xs text-slate-400">
                    Sin actividades
                  </div>
                ) : (
                  <div className="space-y-3">
                    <GrupoDia titulo="Donantes"   eventos={donantes}   esVet={esVet} onAbrir={abrirEvento} />
                    <GrupoDia titulo="Receptoras" eventos={receptoras} esVet={esVet} onAbrir={abrirEvento} />
                    <GrupoDia titulo="Sin rol"    eventos={otros}      esVet={esVet} onAbrir={abrirEvento} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {avisoEco && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {avisoEco}
        </p>
      )}

      {/* Detalle del día seleccionado */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-900 first-letter:uppercase">
            {diaSelec === hoy ? 'Actividades de hoy' : formatDiaLargo(new Date(diaSelec + 'T12:00:00Z'))}
          </h2>
          {/* Visible aunque el día esté vacío: sin tabla no hay otra forma de sacarlos. */}
          {filtros.hayCambios && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Mostrando {filtros.filas.length} de {eventosDia.length}</span>
              <button
                onClick={filtros.limpiar}
                className="flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700"
              >
                <X size={12} /> Quitar filtros
              </button>
            </div>
          )}
        </div>

        {eventosDia.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Sin actividad registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  {ENCABEZADOS.map(({ col, titulo }) => (
                    <th key={col} className="py-2 pr-3 text-left font-medium">
                      <FiltroColumna
                        titulo={titulo}
                        opciones={filtros.opciones(col)}
                        seleccion={filtros.seleccion(col)}
                        onCambiar={(sel) => filtros.setSeleccion(col, sel)}
                        orden={filtros.orden?.columna === col ? filtros.orden.dir : null}
                        onOrdenar={(dir) => filtros.setOrden(dir ? { columna: col, dir } : null)}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtros.filas.length === 0 && (
                  <tr>
                    <td colSpan={ENCABEZADOS.length} className="py-6 text-center text-sm text-slate-400">
                      Ninguna actividad coincide con los filtros.
                    </td>
                  </tr>
                )}
                {filtros.filas.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3 font-medium text-slate-800">
                      <NombreCaballoLink id={e.caballoId} nombre={e.caballoNombre} />
                    </td>
                    <td className="py-2 pr-3 text-slate-500">{e.rol ?? '—'}</td>
                    <td className="py-2 pr-3 text-slate-600">{e.etiqueta}</td>
                    <td className="py-2 pr-3 text-slate-500">{e.veterinario ?? '—'}</td>
                    <td className="py-2 pr-3">
                      <BadgeEstado tipo={e.tipo} />
                    </td>
                    <td className="py-2 text-xs text-slate-500">{e.detalle ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modales — cada uno cierra el recordatorio que lo abrió */}
      {accion?.modal === 'registro' && esVet && (
        <RegistroCriaModal
          recordatorio={accion.recordatorio}
          onClose={() => setAccion(null)}
          onSuccess={recargar}
        />
      )}

      {accion?.modal === 'flushing' && esVet && (
        <FlushingModal
          recordatorio={accion.recordatorio}
          onClose={() => setAccion(null)}
          onSuccess={() => { setAccion(null); recargar() }}
        />
      )}

      {accion?.modal === 'eco' && esVet && (
        <EcografiaModal
          transferencia={accion.transferencia}
          ecografiasExistentes={ecografias.filter((e) => e.transferencia_id === accion.transferencia.id)}
          recordatorio={accion.recordatorio}
          onClose={() => setAccion(null)}
          onSuccess={() => { setAccion(null); recargar() }}
        />
      )}
    </div>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

/** Hecho o falta hacer, con el mismo ícono en el calendario y en la tabla. */
function BadgeEstado({ tipo, compacto = false }: { tipo: TipoEvento; compacto?: boolean }) {
  const Icono = ICONO_ESTADO_EVENTO[tipo]
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded font-medium ${ESTILO_BADGE[tipo]} ${
        compacto ? 'mt-1 px-1.5 py-0.5 text-[10px]' : 'whitespace-nowrap px-2 py-1 text-xs'
      }`}
    >
      <Icono size={compacto ? 9 : 11} className="shrink-0" />
      <span className="truncate">{LABEL_ESTADO_EVENTO[tipo]}</span>
    </span>
  )
}

function Tile({ valor, label, color }: { valor: number; label: string; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className={`text-2xl font-bold ${color}`}>{valor}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  )
}

/** Bloque Donantes / Receptoras dentro de la columna de un día. */
function GrupoDia({
  titulo, eventos, esVet, onAbrir,
}: {
  titulo: string
  eventos: Evento[]
  esVet: boolean
  onAbrir: (evento: Evento) => void
}) {
  if (eventos.length === 0) return null

  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {titulo} <span className="font-normal">({eventos.length})</span>
      </p>
      <div className="space-y-2">
        {eventos.map((e) => {
          // Un registro cargado o una transferencia hecha ya son historia: se
          // abren para mirarlas en la tabla del día, no para cargarlas de nuevo.
          const accionable = esVet && !!e.recordatorio
          return (
            <div
              key={e.id}
              onClick={(ev) => { ev.stopPropagation(); onAbrir(e) }}
              title={accionable
                ? `Hacer ${e.etiqueta} de ${e.caballoNombre}`
                : `${e.caballoNombre} — ya registrado, no hay nada que cargar`}
              className={`cursor-pointer rounded-lg border p-2 hover:brightness-95 ${ESTILO_EVENTO[e.tipo]}`}
            >
              <NombreCaballoLink id={e.caballoId} nombre={e.caballoNombre} className="text-xs font-medium" />
              <div className="truncate text-[11px] opacity-75">{e.etiqueta}</div>
              {/* El tag es lo que evita apretar lo que ya está hecho esperando
                  que abra algo: el tilde no abre nada, el reloj sí. */}
              <BadgeEstado tipo={e.tipo} compacto />
            </div>
          )
        })}
      </div>
    </div>
  )
}
