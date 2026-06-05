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
  marca?: { nombre: string } | null
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
  const rol        = useAuthStore((s) => s.rol)
  const { registros, recordatorios, cargar, cargarParaVet, loading } = useCrianzaStore()

  const [animales,      setAnimales]      = useState<AnimalItem[]>([])
  const [cargandoAnim,  setCargandoAnim]  = useState(true)
  const [inicioRef,     setInicioRef]     = useState(() => inicioSemana(new Date()))
  const [diaSelec,      setDiaSelec]      = useState(() => toISO(new Date()))
  const [modalAbierto,  setModalAbierto]  = useState(false)
  const [caballoModal,  setCaballoModal]  = useState<string | undefined>()

  const dias = useMemo(() => semana(inicioRef), [inicioRef])

  // Carga inicial
  useEffect(() => {
    if (sociedadId) {
      if (registros.length === 0) cargar(sociedadId)
      crianzaService.listarAnimalesReproductivos(sociedadId)
        .then((data) => {
          setAnimales(data.filter((a) => a.categoria !== 'Potrillo' && a.categoria !== 'Caballo'))
        })
        .catch((err) => console.error('[ProgramaSemanal] listarAnimalesReproductivos:', err))
        .finally(() => setCargandoAnim(false))
    } else if (rol === 'veterinario') {
      if (registros.length === 0) cargarParaVet()
      crianzaService.listarAnimalesReproductivosVet()
        .then((data) => {
          setAnimales(data.filter((a: any) => a.categoria !== 'Potrillo' && a.categoria !== 'Caballo'))
        })
        .catch((err) => console.error('[ProgramaSemanal] listarAnimalesReproductivosVet:', err))
        .finally(() => setCargandoAnim(false))
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

  const hoy = toISO(new Date())

  // Animales que tienen registros o recordatorios en el día seleccionado
  const registrosDia   = registros.filter((r) => r.fecha === diaSelec)
  const recordatoriosDia = recordatorios.filter(
    (r) => r.fecha_vto === diaSelec && (r.estado === 'pendiente' || r.estado === 'vencido')
  )

  // Yeguas activas (Donantes + Receptoras)
  const donantes   = animales.filter((a) => a.rol_reproductivo === 'Donante')
  const receptoras = animales.filter((a) => a.rol_reproductivo === 'Receptora')

  if (loading && registros.length === 0) {
    return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
  }

  return (
    <div className="space-y-5 p-1">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Programa semanal</h1>
          <p className="text-sm text-slate-500 mt-0.5 capitalize">{formatMes(inicioRef)}</p>
        </div>
        {rol === 'veterinario' && (
          <button
            onClick={() => abrirModal()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-brand-500 hover:bg-brand-400 text-sm font-medium text-white transition-colors shrink-0"
          >
            <Plus size={15} />
            Nuevo registro
          </button>
        )}
      </div>

      {/* Navegación semanal + grilla */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {/* Controles */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200">
          <button
            onClick={semanaAnterior}
            className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => { setInicioRef(inicioSemana(new Date())); setDiaSelec(hoy) }}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={semanaSiguiente}
            className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Días */}
        <div className="grid grid-cols-7 divide-x divide-slate-200">
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
                    ? 'bg-slate-100'
                    : 'hover:bg-slate-50'
                }`}
              >
                <span className={`font-medium ${
                  esHoy ? 'text-brand-600' : esSelec ? 'text-slate-900' : 'text-slate-500'
                }`}>
                  {formatDia(dia)}
                </span>
                {/* Puntos indicadores */}
                <div className="flex gap-0.5 mt-1.5 h-1.5">
                  {regCount > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-400" title={`${regCount} registro${regCount > 1 ? 's' : ''}`} />
                  )}
                  {recCount > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-400" title={`${recCount} recordatorio${recCount > 1 ? 's' : ''}`} />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Donantes y Receptoras */}
      {cargandoAnim ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {['Donantes', 'Receptoras'].map((t) => (
            <div key={t} className="rounded-lg border border-slate-200 bg-white p-3 animate-pulse">
              <div className="h-3 w-20 bg-slate-100 rounded mb-3" />
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-slate-50 rounded" />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <GrupoAnimales
            titulo="Donantes"
            animales={donantes}
            color="brand"
            canEdit={rol === 'veterinario'}
            onRegistrar={(id) => abrirModal(id)}
            registros={registros}
            recordatorios={recordatorios}
          />
          <GrupoAnimales
            titulo="Receptoras"
            animales={receptoras}
            color="blue"
            canEdit={rol === 'veterinario'}
            onRegistrar={(id) => abrirModal(id)}
            registros={registros}
            recordatorios={recordatorios}
          />
        </div>
      )}

      {/* Panel del día seleccionado */}
      <div className="space-y-4">
        <h2 className="text-sm font-medium text-slate-600">
          {diaSelec === hoy ? 'Hoy' : formatDiaLargo(new Date(diaSelec + 'T12:00:00Z'))}
        </h2>

        {/* Recordatorios del día */}
        {recordatoriosDia.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Bell size={12} />
              Recordatorios
            </p>
            <div className="rounded-lg border border-brand-200 bg-brand-50 divide-y divide-brand-100">
              {recordatoriosDia.map((r) => (
                <div key={r.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      r.estado === 'vencido' ? 'bg-red-400' : 'bg-brand-400'
                    }`} />
                    <span className="font-medium text-slate-700">{r.caballo?.nombre ?? '—'}</span>
                    <span className="text-slate-500">{r.tipo}</span>
                  </div>
                  {rol === 'veterinario' && (
                    <button
                      onClick={() => abrirModal(r.caballo_id)}
                      className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors shrink-0"
                    >
                      Registrar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Registros del día */}
        {registrosDia.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Droplets size={12} />
              Registros del día
            </p>
            <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-200">
              {registrosDia.map((r) => (
                <div key={r.id} className="px-4 py-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-700">{r.caballo?.nombre ?? '—'}</span>
                        <RolBadge rol={r.caballo?.rol_reproductivo ?? null} />
                      </div>
                      {/* Ovarios */}
                      <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-slate-400">
                        {r.ovario_izq.length > 0 && (
                          <span>OI: <span className="text-slate-600">{r.ovario_izq.join(', ')}</span></span>
                        )}
                        {r.ovario_der.length > 0 && (
                          <span>OD: <span className="text-slate-600">{r.ovario_der.join(', ')}</span></span>
                        )}
                        {r.utero.length > 0 && (
                          <span>Út: <span className="text-slate-600">{r.utero.join(', ')}</span></span>
                        )}
                      </div>
                      {/* Chips de acciones */}
                      {r.obs_chips.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {r.obs_chips.map((c) => (
                            <span
                              key={c}
                              className="text-[10px] border border-violet-300 bg-violet-50 text-violet-700 rounded px-1.5 py-0.5"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">
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
          <div className="text-center py-6 text-slate-400 text-sm">
            Sin actividad registrada.
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

function RolBadge({ rol }: { rol: RolReproductivo }) {
  if (!rol) return null
  return (
    <span className={`text-[10px] border rounded px-1.5 py-0.5 ${
      rol === 'Donante'
        ? 'border-brand-300 text-brand-600'
        : 'border-blue-300 text-blue-600'
    }`}>
      {rol}
    </span>
  )
}

function FilaAnimal({
  a, canEdit, onRegistrar, registros, recordatorios,
}: {
  a: AnimalItem
  canEdit: boolean
  onRegistrar: (id: string) => void
  registros: ReturnType<typeof useCrianzaStore.getState>['registros']
  recordatorios: ReturnType<typeof useCrianzaStore.getState>['recordatorios']
}) {
  const hoy = toISO(new Date())
  const ultReg = registros
    .filter((r) => r.caballo_id === a.id)
    .sort((x, y) => y.fecha.localeCompare(x.fecha))[0]
  const recHoy = recordatorios.filter(
    (r) => r.caballo_id === a.id && r.fecha_vto === hoy &&
      (r.estado === 'pendiente' || r.estado === 'vencido')
  )

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm text-slate-700 font-medium truncate">{a.nombre}</p>
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
          {a.campo && <span>{a.campo.nombre}</span>}
          {ultReg && <span>Últ. {formatFechaCorta(ultReg.fecha)}</span>}
          {recHoy.length > 0 && (
            <span className="text-brand-600">{recHoy[0].tipo}</span>
          )}
        </div>
      </div>
      {canEdit && (
        <button
          onClick={() => onRegistrar(a.id)}
          className="shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
        >
          <Plus size={11} />
          Reg.
        </button>
      )}
    </div>
  )
}

function GrupoAnimales({
  titulo, animales, color, canEdit = true, onRegistrar, registros, recordatorios,
}: {
  titulo: string
  animales: AnimalItem[]
  color: 'brand' | 'blue'
  canEdit?: boolean
  onRegistrar: (id: string) => void
  registros: ReturnType<typeof useCrianzaStore.getState>['registros']
  recordatorios: ReturnType<typeof useCrianzaStore.getState>['recordatorios']
}) {
  const borderColor = color === 'brand' ? 'border-brand-200' : 'border-blue-200'
  const titleColor  = color === 'brand' ? 'text-brand-600' : 'text-blue-600'

  if (animales.length === 0) return null

  // Agrupar por empresa (marca), luego por campo
  const porEmpresa = animales.reduce<Record<string, AnimalItem[]>>((acc, a) => {
    const key = a.marca?.nombre ?? 'Sin empresa'
    ;(acc[key] ??= []).push(a)
    return acc
  }, {})

  const empresas = Object.keys(porEmpresa).sort((a, b) =>
    a === 'Sin empresa' ? 1 : b === 'Sin empresa' ? -1 : a.localeCompare(b)
  )

  return (
    <div className={`rounded-lg border bg-white p-3 ${borderColor}`}>
      <p className={`text-xs font-medium mb-3 ${titleColor}`}>
        {titulo} <span className="text-slate-400 font-normal">({animales.length})</span>
      </p>
      <div className="space-y-4">
        {empresas.map((empresa) => {
          const animalesEmpresa = porEmpresa[empresa]

          // Sub-agrupar por campo dentro de la empresa
          const porCampo = animalesEmpresa.reduce<Record<string, AnimalItem[]>>((acc, a) => {
            const key = a.campo?.nombre ?? 'Sin campo'
            ;(acc[key] ??= []).push(a)
            return acc
          }, {})

          const campos = Object.keys(porCampo).sort((a, b) =>
            a === 'Sin campo' ? 1 : b === 'Sin campo' ? -1 : a.localeCompare(b)
          )
          const tieneVariosCampos = campos.length > 1 || (campos.length === 1 && campos[0] !== 'Sin campo')

          return (
            <div key={empresa}>
              <p className="text-xs font-semibold text-slate-600 mb-1.5">{empresa}</p>
              {tieneVariosCampos ? (
                <div className="space-y-3 pl-2 border-l border-slate-100">
                  {campos.map((campo) => (
                    <div key={campo}>
                      <p className="text-[11px] text-slate-400 mb-1">{campo}</p>
                      <div className="space-y-2">
                        {porCampo[campo].map((a) => (
                          <FilaAnimal
                            key={a.id}
                            a={a}
                            canEdit={canEdit}
                            onRegistrar={onRegistrar}
                            registros={registros}
                            recordatorios={recordatorios}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2 pl-2 border-l border-slate-100">
                  {animalesEmpresa.map((a) => (
                    <FilaAnimal
                      key={a.id}
                      a={a}
                      canEdit={canEdit}
                      onRegistrar={onRegistrar}
                      registros={registros}
                      recordatorios={recordatorios}
                    />
                  ))}
                </div>
              )}
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
