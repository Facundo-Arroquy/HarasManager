import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Stethoscope, AlertCircle, Calendar, Tag, Bell } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { caballoService } from '../../services/caballoService'
import { campoService, type CampoConConteo } from '../../services/campoService'
import { historialService } from '../../services/historialService'
import { alertaService, type Alerta } from '../../services/alertaService'
import Spinner from '../../components/ui/Spinner'
import { hoyAR, formatFechaCorta } from '../../utils/fecha'

type Caballo    = Awaited<ReturnType<typeof caballoService.listar>>[number]
type HistResumen = Awaited<ReturnType<typeof historialService.listarRecientesTodos>>[number]

const CATEGORIAS = ['Caballo', 'Yegua', 'Padrillo', 'Potrillo'] as const

const CAT_STYLE: Record<string, string> = {
  Caballo:  'bg-slate-100 text-slate-600',
  Yegua:    'bg-pink-100 text-pink-700',
  Padrillo: 'bg-blue-100 text-blue-700',
  Potrillo: 'bg-brand-100 text-brand-700',
}

export default function DashboardPage() {
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const navigate   = useNavigate()

  const [caballos,  setCaballos]  = useState<Caballo[]>([])
  const [campos,    setCampos]    = useState<CampoConConteo[]>([])
  const [historial, setHistorial] = useState<HistResumen[]>([])
  const [alertas,   setAlertas]   = useState<Alerta[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    if (!sociedadId) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      caballoService.listar(sociedadId),
      campoService.listarConConteo(sociedadId),
      historialService.listarRecientesTodos(sociedadId, 10),
      alertaService.listar({ sociedadId, esVet: false }).catch(() => [] as Alerta[]),
    ]).then(([c, f, h, a]) => {
      setCaballos(c)
      setCampos(f)
      setHistorial(h)
      setAlertas(a)
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

  const alertasProximas = useMemo(() => {
    const hoyDate = new Date(); hoyDate.setHours(0, 0, 0, 0)
    return alertas
      .filter((a) => {
        const fecha = new Date(a.fecha_alerta + 'T00:00:00')
        const dias  = Math.round((fecha.getTime() - hoyDate.getTime()) / 86400000)
        return dias <= 7
      })
      .slice(0, 5)
  }, [alertas])

  const hoy = hoyAR()   // fecha actual en America/Argentina/Buenos_Aires
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
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Panel</h1>
        <p className="text-sm text-slate-400 mt-0.5">Resumen del establecimiento</p>
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
          accent={pendientesHoy.length > 0 ? 'brand' : 'zinc'}
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
        <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-600 mb-4">Distribución por campo</h2>
          {campos.length === 0 ? (
            <p className="text-xs text-slate-400">No hay campos registrados.</p>
          ) : (
            <div className="space-y-3.5">
              {campos.map((campo) => (
                <div key={campo.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 truncate">{campo.nombre}</span>
                    <span className="text-slate-400 shrink-0 ml-2">
                      {campo.caballos_count} animal{campo.caballos_count !== 1 ? 'es' : ''}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all duration-500"
                      style={{ width: `${(campo.caballos_count / maxAnimales) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              {sinCampo > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 italic">Sin campo asignado</span>
                    <span className="text-slate-400">{sinCampo} animal{sinCampo !== 1 ? 'es' : ''}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-400"
                      style={{ width: `${(sinCampo / maxAnimales) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Por categoría */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-600 mb-4">Por categoría</h2>
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

      {/* Alertas próximas */}
      {alertasProximas.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-600">Alertas próximas</h2>
            <button
              onClick={() => navigate('/alertas')}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium"
            >
              Ver todas →
            </button>
          </div>
          <div className="space-y-1">
            {alertasProximas.map((alerta) => (
              <AlertaWidget key={alerta.id} alerta={alerta} onClick={() => navigate('/alertas')} />
            ))}
          </div>
        </div>
      )}

      {/* Últimas + Próximas consultas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Últimas consultas */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-600 mb-4">Últimas consultas clínicas</h2>
          {ultimasConsultas.length === 0 ? (
            <p className="text-xs text-slate-400">Sin consultas registradas.</p>
          ) : (
            <div className="space-y-1">
              {ultimasConsultas.map((h) => (
                <button
                  key={h.id}
                  onClick={() => navigate(`/caballos/${h.caballo_id}/historial`)}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-100/80 transition-colors"
                >
                  <Stethoscope size={13} className="text-brand-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{h.caballo_nombre}</p>
                    <p className="text-[11px] text-slate-400 truncate">{h.tipo}</p>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">{formatFechaCorta(h.fecha_consulta)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Próximas consultas */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-600 mb-4">Próximas revisiones agendadas</h2>
          {proximasConsultas.length === 0 ? (
            <p className="text-xs text-slate-400">No hay revisiones próximas agendadas.</p>
          ) : (
            <div className="space-y-1">
              {proximasConsultas.map((h) => (
                <button
                  key={h.id}
                  onClick={() => navigate(`/caballos/${h.caballo_id}/historial`)}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-100/80 transition-colors"
                >
                  <Calendar size={13} className="text-brand-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{h.caballo_nombre}</p>
                    <p className="text-[11px] text-slate-400 truncate">{h.tipo}</p>
                  </div>
                  <span className="text-[11px] text-brand-600 shrink-0">{formatFechaCorta(h.proxima_consulta)}</span>
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
  accent: 'emerald' | 'brand' | 'rose' | 'zinc'
  onClick?: () => void
}

const ACCENT_CLASS: Record<string, string> = {
  emerald: 'text-brand-600',
  brand:   'text-brand-600',
  rose:    'text-rose-600',
  zinc:    'text-slate-500',
}

// ── Alerta Widget ─────────────────────────────────────────────────────────────

function AlertaWidget({ alerta, onClick }: { alerta: Alerta; onClick: () => void }) {
  const hoyDate = new Date(); hoyDate.setHours(0, 0, 0, 0)
  const fecha   = new Date(alerta.fecha_alerta + 'T00:00:00')
  const dias    = Math.round((fecha.getTime() - hoyDate.getTime()) / 86400000)

  const badge =
    dias < 0  ? { label: 'Vencida',          cls: 'bg-red-100 text-red-700' } :
    dias === 0 ? { label: 'Hoy',              cls: 'bg-orange-100 text-orange-700' } :
                 { label: `En ${dias} día${dias !== 1 ? 's' : ''}`, cls: 'bg-brand-100 text-brand-700' }

  const iconColor = dias < 0 ? 'text-red-500' : dias === 0 ? 'text-orange-500' : 'text-brand-500'

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
    >
      <Bell size={13} className={`${iconColor} shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-700 truncate">{alerta.motivo}</p>
        {alerta.caballos.length > 0 && (
          <p className="text-[11px] text-slate-400 truncate">
            {alerta.caballos.map((c) => c.nombre).join(', ')}
          </p>
        )}
      </div>
      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${badge.cls}`}>
        {badge.label}
      </span>
    </button>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon, accent, onClick }: KpiCardProps) {
  const color = ACCENT_CLASS[accent]
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-slate-200 bg-white p-5 ${
        onClick ? 'cursor-pointer hover:border-slate-300 transition-colors' : ''
      }`}
    >
      <div className={`flex items-center gap-2 mb-3 ${color}`}>
        {icon}
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
