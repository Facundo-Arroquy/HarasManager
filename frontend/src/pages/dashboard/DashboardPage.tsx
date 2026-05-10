import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Stethoscope, AlertCircle, Calendar, Tag } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { caballoService } from '../../services/caballoService'
import { campoService, type CampoConConteo } from '../../services/campoService'
import { historialService } from '../../services/historialService'
import Spinner from '../../components/ui/Spinner'

type Caballo    = Awaited<ReturnType<typeof caballoService.listar>>[number]
type HistResumen = Awaited<ReturnType<typeof historialService.listarRecientesTodos>>[number]

const CATEGORIAS = ['Caballo', 'Yegua', 'Padrillo', 'Potrillo'] as const

const CAT_STYLE: Record<string, string> = {
  Caballo:  'bg-zinc-800 text-zinc-300',
  Yegua:    'bg-pink-950/70 text-pink-300',
  Padrillo: 'bg-blue-950/70 text-blue-300',
  Potrillo: 'bg-amber-950/70 text-amber-300',
}

function fmtCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

export default function DashboardPage() {
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const navigate   = useNavigate()

  const [caballos,  setCaballos]  = useState<Caballo[]>([])
  const [campos,    setCampos]    = useState<CampoConConteo[]>([])
  const [historial, setHistorial] = useState<HistResumen[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    if (!sociedadId) return
    setLoading(true)
    Promise.all([
      caballoService.listar(sociedadId),
      campoService.listarConConteo(sociedadId),
      historialService.listarRecientesTodos(sociedadId, 10),
    ]).then(([c, f, h]) => {
      setCaballos(c)
      setCampos(f)
      setHistorial(h)
    }).finally(() => setLoading(false))
  }, [sociedadId])

  const sinCampo    = useMemo(() => caballos.filter((c) => !(c as any).campo_id).length, [caballos])
  const sinChip     = useMemo(() => caballos.filter((c) => !c.numero_chip).length, [caballos])
  const maxAnimales = useMemo(() => Math.max(...campos.map((c) => c.caballos_count), 1), [campos])

  const porCategoria = useMemo(() =>
    CATEGORIAS.map((cat) => ({
      nombre: cat,
      count: caballos.filter((c) => c.categoria === cat).length,
    })), [caballos])

  const hoy = new Date().toISOString().split('T')[0]
  const ultimasConsultas  = historial.slice(0, 5)
  const proximasConsultas = useMemo(() =>
    historial
      .filter((h) => h.proxima_consulta && h.proxima_consulta >= hoy)
      .sort((a, b) => a.proxima_consulta!.localeCompare(b.proxima_consulta!))
      .slice(0, 5),
    [historial, hoy])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Panel</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Resumen del establecimiento</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Caballos activos"
          value={caballos.length}
          icon={<Stethoscope size={15} />}
          accent="emerald"
        />
        <KpiCard
          label="Sin campo asignado"
          value={sinCampo}
          icon={<MapPin size={15} />}
          accent={sinCampo > 0 ? 'amber' : 'zinc'}
          onClick={sinCampo > 0 ? () => navigate('/caballos') : undefined}
        />
        <KpiCard
          label="Sin chip registrado"
          value={sinChip}
          icon={<AlertCircle size={15} />}
          accent={sinChip > 0 ? 'rose' : 'zinc'}
        />
        <KpiCard
          label="Campos / caballerizas"
          value={campos.length}
          icon={<Tag size={15} />}
          accent="zinc"
          onClick={() => navigate('/config')}
        />
      </div>

      {/* Distribución por campo + categoría */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Por campo */}
        <div className="lg:col-span-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Distribución por campo</h2>
          {campos.length === 0 ? (
            <p className="text-xs text-zinc-600">No hay campos registrados.</p>
          ) : (
            <div className="space-y-3.5">
              {campos.map((campo) => (
                <div key={campo.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 truncate">{campo.nombre}</span>
                    <span className="text-zinc-500 shrink-0 ml-2">
                      {campo.caballos_count} animal{campo.caballos_count !== 1 ? 'es' : ''}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                      style={{ width: `${(campo.caballos_count / maxAnimales) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              {sinCampo > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-600 italic">Sin campo asignado</span>
                    <span className="text-zinc-600">{sinCampo} animal{sinCampo !== 1 ? 'es' : ''}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-zinc-600"
                      style={{ width: `${(sinCampo / maxAnimales) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Por categoría */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Por categoría</h2>
          <div className="grid grid-cols-2 gap-3 h-[calc(100%-2rem)]">
            {porCategoria.map(({ nombre, count }) => (
              <div key={nombre} className={`rounded-lg p-3 flex flex-col justify-between ${CAT_STYLE[nombre]}`}>
                <p className="text-xs opacity-60">{nombre}</p>
                <p className="text-3xl font-bold mt-1">{count}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Últimas + Próximas consultas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Últimas consultas */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Últimas consultas clínicas</h2>
          {ultimasConsultas.length === 0 ? (
            <p className="text-xs text-zinc-600">Sin consultas registradas.</p>
          ) : (
            <div className="space-y-1">
              {ultimasConsultas.map((h) => (
                <button
                  key={h.id}
                  onClick={() => navigate(`/caballos/${h.caballo_id}/historial`)}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-zinc-800/80 transition-colors"
                >
                  <Stethoscope size={13} className="text-emerald-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-200 truncate">{h.caballo_nombre}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{h.tipo}</p>
                  </div>
                  <span className="text-[11px] text-zinc-600 shrink-0">{fmtCorta(h.fecha_consulta)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Próximas consultas */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Próximas revisiones agendadas</h2>
          {proximasConsultas.length === 0 ? (
            <p className="text-xs text-zinc-600">No hay revisiones próximas agendadas.</p>
          ) : (
            <div className="space-y-1">
              {proximasConsultas.map((h) => (
                <button
                  key={h.id}
                  onClick={() => navigate(`/caballos/${h.caballo_id}/historial`)}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-zinc-800/80 transition-colors"
                >
                  <Calendar size={13} className="text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-200 truncate">{h.caballo_nombre}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{h.tipo}</p>
                  </div>
                  <span className="text-[11px] text-amber-600 shrink-0">{fmtCorta(h.proxima_consulta!)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: number
  icon: React.ReactNode
  accent: 'emerald' | 'amber' | 'rose' | 'zinc'
  onClick?: () => void
}

const ACCENT_CLASS: Record<string, string> = {
  emerald: 'text-emerald-400',
  amber:   'text-amber-400',
  rose:    'text-rose-400',
  zinc:    'text-zinc-400',
}

function KpiCard({ label, value, icon, accent, onClick }: KpiCardProps) {
  const color = ACCENT_CLASS[accent]
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-zinc-800 bg-zinc-900 p-5 ${
        onClick ? 'cursor-pointer hover:border-zinc-700 transition-colors' : ''
      }`}
    >
      <div className={`flex items-center gap-2 mb-3 ${color}`}>
        {icon}
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
