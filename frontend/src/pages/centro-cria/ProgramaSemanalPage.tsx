import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useCrianzaStore } from '../../store/crianzaStore'
import Spinner from '../../components/ui/Spinner'
import RegistroCriaModal from '../../components/centro-cria/RegistroCriaModal'
import FlushingBanner from '../../components/centro-cria/FlushingBanner'
import type { RolReproductivo } from '../../types/crianza'

// ── Utilidades de fecha ───────────────────────────────────────────────────────

function inicioSemana(ref: Date): Date {
  const d = new Date(ref)
  const dow = d.getDay() // 0=Dom
  const diff = dow === 0 ? -6 : 1 - dow // lunes como inicio
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]
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
type TipoEvento = 'vencido' | 'pendiente' | 'registro' | 'transferencia'

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
}

const ESTILO_EVENTO: Record<TipoEvento, string> = {
  vencido:       'bg-red-50 border-red-200 text-red-900',
  pendiente:     'bg-green-50 border-green-200 text-green-900',
  registro:      'bg-blue-50 border-blue-200 text-blue-900',
  transferencia: 'bg-purple-50 border-purple-200 text-purple-900',
}

const ESTILO_BADGE: Record<TipoEvento, string> = {
  vencido:       'bg-red-100 text-red-700',
  pendiente:     'bg-green-100 text-green-700',
  registro:      'bg-blue-100 text-blue-700',
  transferencia: 'bg-purple-100 text-purple-700',
}

const LABEL_ESTADO_EVENTO: Record<TipoEvento, string> = {
  vencido:       'Vencido',
  pendiente:     'Programado',
  registro:      'Registrado',
  transferencia: 'Transferencia',
}

function nombreVet(v?: { nombre: string; apellido: string } | null): string | null {
  return v ? `Dr/a. ${v.nombre} ${v.apellido}`.trim() : null
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ProgramaSemanalPage() {
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const rol        = useAuthStore((s) => s.rol)
  const { registros, recordatorios, transferencias, cargar, cargarParaVet, loading } = useCrianzaStore()

  const [inicioRef,    setInicioRef]    = useState(() => inicioSemana(new Date()))
  const [diaSelec,     setDiaSelec]     = useState(() => toISO(new Date()))
  const [modalAbierto, setModalAbierto] = useState(false)
  const [caballoModal, setCaballoModal] = useState<string | undefined>()

  const dias = useMemo(() => semana(inicioRef), [inicioRef])
  const hoy  = toISO(new Date())

  // Carga inicial
  useEffect(() => {
    if (sociedadId) {
      if (registros.length === 0) cargar(sociedadId)
    } else if (rol === 'veterinario') {
      if (registros.length === 0) cargarParaVet()
    }
  }, [sociedadId, rol]) // eslint-disable-line react-hooks/exhaustive-deps

  function semanaAnterior() {
    const d = new Date(inicioRef)
    d.setDate(d.getDate() - 7)
    setInicioRef(d)
  }

  function semanaSiguiente() {
    const d = new Date(inicioRef)
    d.setDate(d.getDate() + 7)
    setInicioRef(d)
  }

  function abrirModal(caballoId?: string) {
    setCaballoModal(caballoId)
    setModalAbierto(true)
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
        // Los recordatorios no traen join de veterinario, solo veterinario_id.
        veterinario:   null,
        detalle:       r.notas,
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
  }, [registros, recordatorios, transferencias])

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
            onClick={() => { setInicioRef(inicioSemana(new Date())); setDiaSelec(hoy) }}
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
          {rol === 'veterinario' && (
            <button
              onClick={() => abrirModal()}
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
        <Tile valor={resumen.programados}    label="Programados"    color="text-green-600" />
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
                    <GrupoDia
                      titulo="Donantes"
                      eventos={donantes}
                      canEdit={rol === 'veterinario'}
                      onRegistrar={abrirModal}
                    />
                    <GrupoDia
                      titulo="Receptoras"
                      eventos={receptoras}
                      canEdit={rol === 'veterinario'}
                      onRegistrar={abrirModal}
                    />
                    <GrupoDia
                      titulo="Sin rol"
                      eventos={otros}
                      canEdit={rol === 'veterinario'}
                      onRegistrar={abrirModal}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Detalle del día seleccionado */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-bold text-slate-900 first-letter:uppercase">
          {diaSelec === hoy ? 'Actividades de hoy' : formatDiaLargo(new Date(diaSelec + 'T12:00:00Z'))}
        </h2>

        {eventosDia.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Sin actividad registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 text-left font-medium">Caballo</th>
                  <th className="py-2 text-left font-medium">Rol</th>
                  <th className="py-2 text-left font-medium">Tipo</th>
                  <th className="py-2 text-left font-medium">Veterinario</th>
                  <th className="py-2 text-left font-medium">Estado</th>
                  <th className="py-2 text-left font-medium">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {eventosDia.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3 font-medium text-slate-800">{e.caballoNombre}</td>
                    <td className="py-2 pr-3 text-slate-500">{e.rol ?? '—'}</td>
                    <td className="py-2 pr-3 text-slate-600">{e.etiqueta}</td>
                    <td className="py-2 pr-3 text-slate-500">{e.veterinario ?? '—'}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded px-2 py-1 text-xs font-medium ${ESTILO_BADGE[e.tipo]}`}>
                        {LABEL_ESTADO_EVENTO[e.tipo]}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-slate-500">{e.detalle ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalAbierto && rol === 'veterinario' && (
        <RegistroCriaModal
          caballoIdInicial={caballoModal}
          onClose={() => { setModalAbierto(false); setCaballoModal(undefined) }}
          onSuccess={() => {
            if (sociedadId) cargar(sociedadId)
            else if (rol === 'veterinario') cargarParaVet()
          }}
        />
      )}
    </div>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

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
  titulo, eventos, canEdit, onRegistrar,
}: {
  titulo: string
  eventos: Evento[]
  canEdit: boolean
  onRegistrar: (caballoId: string) => void
}) {
  if (eventos.length === 0) return null

  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {titulo} <span className="font-normal">({eventos.length})</span>
      </p>
      <div className="space-y-2">
        {eventos.map((e) => (
          <div
            key={e.id}
            onClick={canEdit ? (ev) => { ev.stopPropagation(); onRegistrar(e.caballoId) } : undefined}
            title={canEdit ? `Registrar sobre ${e.caballoNombre}` : undefined}
            className={`rounded-lg border p-2 ${ESTILO_EVENTO[e.tipo]} ${
              canEdit ? 'cursor-pointer hover:brightness-95' : ''
            }`}
          >
            <div className="truncate text-xs font-medium">{e.caballoNombre}</div>
            <div className="truncate text-[11px] opacity-75">{e.etiqueta}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
