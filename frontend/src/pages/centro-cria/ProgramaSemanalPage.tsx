import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Bell, Droplets } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useCrianzaStore } from '../../store/crianzaStore'
import { crianzaService } from '../../services/crianzaService'
import Spinner from '../../components/ui/Spinner'
import RegistroCriaModal from '../../components/centro-cria/RegistroCriaModal'
import type { RolReproductivo } from '../../types/crianza'

// ── Tipos locales ─────────────────────────────────────────────────────────────

type AnimalItem = {
  id: string
  nombre: string
  categoria: string
  rol_reproductivo: RolReproductivo
  campo: { nombre: string } | null
}

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

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function formatDia(d: Date): string {
  return `${DIAS[d.getDay() === 0 ? 6 : d.getDay() - 1]} ${d.getDate()}`
}

function formatMes(d: Date): string {
  return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ProgramaSemanalPage() {
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const { registros, recordatorios, cargar, loading } = useCrianzaStore()

  const [animales,      setAnimales]      = useState<AnimalItem[]>([])
  const [cargandoAnim,  setCargandoAnim]  = useState(true)
  const [inicioRef,     setInicioRef]     = useState(() => inicioSemana(new Date()))
  const [diaSelec,      setDiaSelec]      = useState(() => toISO(new Date()))
  const [modalAbierto,  setModalAbierto]  = useState(false)
  const [caballoModal,  setCaballoModal]  = useState<string | undefined>()

  const dias = useMemo(() => semana(inicioRef), [inicioRef])

  // Carga inicial
  useEffect(() => {
    if (!sociedadId) return
    if (registros.length === 0) cargar(sociedadId)
    crianzaService.listarAnimalesReproductivos(sociedadId).then((data) => {
      setAnimales(data.filter((a) => a.categoria !== 'Potrillo' && a.categoria !== 'Caballo'))
      setCargandoAnim(false)
    })
  }, [sociedadId]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const hoy = toISO(new Date())

  // Animales que tienen registros o recordatorios en el día seleccionado
  const registrosDia   = registros.filter((r) => r.fecha === diaSelec)
  const recordatoriosDia = recordatorios.filter(
    (r) => r.fecha_vto === diaSelec && (r.estado === 'pendiente' || r.estado === 'vencido')
  )

  // Yeguas activas (Donantes + Receptoras)
  const donantes   = animales.filter((a) => a.rol_reproductivo === 'Donante')
  const receptoras = animales.filter((a) => a.rol_reproductivo === 'Receptora')
  const padrillos  = animales.filter((a) => a.categoria === 'Padrillo')
  const sinRol     = animales.filter((a) => a.categoria === 'Yegua' && !a.rol_reproductivo)

  if (loading && registros.length === 0) {
    return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
  }

  return (
    <div className="space-y-5 p-1">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Programa semanal</h1>
          <p className="text-sm text-zinc-400 mt-0.5 capitalize">{formatMes(inicioRef)}</p>
        </div>
        <button
          onClick={() => abrirModal()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm font-medium text-white transition-colors shrink-0"
        >
          <Plus size={15} />
          Nuevo registro
        </button>
      </div>

      {/* Navegación semanal + grilla */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
        {/* Controles */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
          <button
            onClick={semanaAnterior}
            className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => { setInicioRef(inicioSemana(new Date())); setDiaSelec(hoy) }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={semanaSiguiente}
            className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Días */}
        <div className="grid grid-cols-7 divide-x divide-zinc-800">
          {dias.map((dia) => {
            const iso       = toISO(dia)
            const esHoy     = iso === hoy
            const esSelec   = iso === diaSelec
            const regCount  = registros.filter((r) => r.fecha === iso).length
            const recCount  = recordatorios.filter(
              (r) => r.fecha_vto === iso && (r.estado === 'pendiente' || r.estado === 'vencido')
            ).length

            return (
              <button
                key={iso}
                onClick={() => setDiaSelec(iso)}
                className={`flex flex-col items-center py-2.5 px-1 text-xs transition-colors ${
                  esSelec
                    ? 'bg-zinc-800'
                    : 'hover:bg-zinc-800/50'
                }`}
              >
                <span className={`font-medium ${
                  esHoy ? 'text-emerald-400' : esSelec ? 'text-zinc-100' : 'text-zinc-400'
                }`}>
                  {formatDia(dia)}
                </span>
                {/* Puntos indicadores */}
                <div className="flex gap-0.5 mt-1.5 h-1.5">
                  {regCount > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title={`${regCount} registro${regCount > 1 ? 's' : ''}`} />
                  )}
                  {recCount > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title={`${recCount} recordatorio${recCount > 1 ? 's' : ''}`} />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Panel del día seleccionado */}
      <div className="space-y-4">
        <h2 className="text-sm font-medium text-zinc-300">
          {diaSelec === hoy ? 'Hoy' : formatDiaLargo(new Date(diaSelec + 'T12:00:00Z'))}
        </h2>

        {/* Recordatorios del día */}
        {recordatoriosDia.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-zinc-500 flex items-center gap-1.5">
              <Bell size={12} />
              Recordatorios
            </p>
            <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 divide-y divide-amber-900/30">
              {recordatoriosDia.map((r) => (
                <div key={r.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      r.estado === 'vencido' ? 'bg-red-400' : 'bg-amber-400'
                    }`} />
                    <span className="font-medium text-zinc-200">{r.caballo?.nombre ?? '—'}</span>
                    <span className="text-zinc-400">{r.tipo}</span>
                  </div>
                  <button
                    onClick={() => abrirModal(r.caballo_id)}
                    className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors shrink-0"
                  >
                    Registrar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Registros del día */}
        {registrosDia.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-zinc-500 flex items-center gap-1.5">
              <Droplets size={12} />
              Registros del día
            </p>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">
              {registrosDia.map((r) => (
                <div key={r.id} className="px-4 py-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-zinc-200">{r.caballo?.nombre ?? '—'}</span>
                        <RolBadge rol={r.caballo?.rol_reproductivo ?? null} />
                      </div>
                      {/* Ovarios */}
                      <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-zinc-500">
                        {r.ovario_izq.length > 0 && (
                          <span>OI: <span className="text-zinc-300">{r.ovario_izq.join(', ')}</span></span>
                        )}
                        {r.ovario_der.length > 0 && (
                          <span>OD: <span className="text-zinc-300">{r.ovario_der.join(', ')}</span></span>
                        )}
                        {r.utero.length > 0 && (
                          <span>Út: <span className="text-zinc-300">{r.utero.join(', ')}</span></span>
                        )}
                      </div>
                      {/* Chips de acciones */}
                      {r.obs_chips.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {r.obs_chips.map((c) => (
                            <span
                              key={c}
                              className="text-[10px] border border-violet-700 bg-violet-900/30 text-violet-300 rounded px-1.5 py-0.5"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-zinc-600 shrink-0">
                      {r.veterinario ? `Dr/a. ${r.veterinario.apellido}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estado vacío del día */}
        {registrosDia.length === 0 && recordatoriosDia.length === 0 && (
          <div className="text-center py-8 text-zinc-600 text-sm">
            Sin actividad registrada.
          </div>
        )}
      </div>

      {/* Resumen de animales del programa */}
      {!cargandoAnim && (
        <div className="grid gap-4 sm:grid-cols-2">
          <GrupoAnimales
            titulo="Donantes"
            animales={donantes}
            color="amber"
            onRegistrar={(id) => abrirModal(id)}
            registros={registros}
            recordatorios={recordatorios}
          />
          <GrupoAnimales
            titulo="Receptoras"
            animales={receptoras}
            color="blue"
            onRegistrar={(id) => abrirModal(id)}
            registros={registros}
            recordatorios={recordatorios}
          />
          {padrillos.length > 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
              <p className="text-xs font-medium text-zinc-500 mb-2">Padrillos</p>
              <div className="space-y-1">
                {padrillos.map((p) => (
                  <p key={p.id} className="text-sm text-zinc-300">{p.nombre}</p>
                ))}
              </div>
            </div>
          )}
          {sinRol.length > 0 && (
            <div className="rounded-lg border border-zinc-700 border-dashed bg-zinc-900/50 p-3">
              <p className="text-xs font-medium text-zinc-600 mb-2">Sin rol asignado</p>
              <div className="space-y-1">
                {sinRol.map((y) => (
                  <div key={y.id} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">{y.nombre}</span>
                    <button
                      onClick={() => abrirModal(y.id)}
                      className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
                    >
                      + Registro
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modalAbierto && (
        <RegistroCriaModal
          caballoIdInicial={caballoModal}
          onClose={() => { setModalAbierto(false); setCaballoModal(undefined) }}
          onSuccess={() => sociedadId && cargar(sociedadId)}
        />
      )}
    </div>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function RolBadge({ rol }: { rol: RolReproductivo }) {
  if (!rol) return null
  return (
    <span className={`text-[10px] border rounded px-1.5 py-0.5 ${
      rol === 'Donante'
        ? 'border-amber-700 text-amber-400'
        : 'border-blue-700 text-blue-400'
    }`}>
      {rol}
    </span>
  )
}

function GrupoAnimales({
  titulo, animales, color, onRegistrar, registros, recordatorios,
}: {
  titulo: string
  animales: AnimalItem[]
  color: 'amber' | 'blue'
  onRegistrar: (id: string) => void
  registros: ReturnType<typeof useCrianzaStore.getState>['registros']
  recordatorios: ReturnType<typeof useCrianzaStore.getState>['recordatorios']
}) {
  const hoy = toISO(new Date())
  const borderColor = color === 'amber' ? 'border-amber-800/40' : 'border-blue-800/40'
  const titleColor  = color === 'amber' ? 'text-amber-400' : 'text-blue-400'

  if (animales.length === 0) return null

  return (
    <div className={`rounded-lg border bg-zinc-900 p-3 ${borderColor}`}>
      <p className={`text-xs font-medium mb-2 ${titleColor}`}>{titulo}</p>
      <div className="space-y-2">
        {animales.map((a) => {
          const ultReg = registros
            .filter((r) => r.caballo_id === a.id)
            .sort((x, y) => y.fecha.localeCompare(x.fecha))[0]

          const recHoy = recordatorios.filter(
            (r) => r.caballo_id === a.id && r.fecha_vto === hoy &&
              (r.estado === 'pendiente' || r.estado === 'vencido')
          )

          return (
            <div key={a.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-zinc-200 font-medium truncate">{a.nombre}</p>
                <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                  {a.campo && <span>{a.campo.nombre}</span>}
                  {ultReg && (
                    <span>Últ. {formatFechaCorta(ultReg.fecha)}</span>
                  )}
                  {recHoy.length > 0 && (
                    <span className="text-amber-400">
                      {recHoy[0].tipo}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => onRegistrar(a.id)}
                className="shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
              >
                <Plus size={11} />
                Reg.
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Utilidades ────────────────────────────────────────────────────────────────

function formatDiaLargo(d: Date): string {
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatFechaCorta(fecha: string): string {
  const [, m, d] = fecha.split('-')
  return `${d}/${m}`
}
