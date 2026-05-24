import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutGrid, AlertTriangle, ClipboardList, ChevronRight, Clock } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { caballoService } from '../../services/caballoService'
import { historialService, type AlertaVet } from '../../services/historialService'
import Spinner from '../../components/ui/Spinner'

type HistorialResumen = Awaited<ReturnType<typeof historialService.listarRecientesVet>>[number]

function formatFecha(iso: string): string {
  const [y, m, d] = iso.split('-')
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`
}

function diasLabel(dias: number): { texto: string; clase: string } {
  if (dias < 0)  return { texto: `Vencida hace ${Math.abs(dias)}d`, clase: 'text-rose-600 bg-rose-50 border-rose-200' }
  if (dias === 0) return { texto: 'Hoy',                            clase: 'text-rose-600 bg-rose-50 border-rose-200' }
  if (dias <= 3)  return { texto: `En ${dias}d`,                    clase: 'text-amber-600 bg-amber-50 border-amber-200' }
  return              { texto: `En ${dias}d`,                    clase: 'text-slate-600 bg-slate-50 border-slate-200' }
}

export default function PanelVetPage() {
  const user   = useAuthStore((s) => s.user)
  const userId = user?.id
  const navigate = useNavigate()

  const [cantCaballos, setCantCaballos] = useState<number | null>(null)
  const [consultas,    setConsultas]    = useState<HistorialResumen[]>([])
  const [alertas,      setAlertas]      = useState<AlertaVet[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    Promise.allSettled([
      caballoService.listarDelVeterinario(userId).then((c) => setCantCaballos(c.length)),
      historialService.listarRecientesVet(5).then(setConsultas),
      historialService.listarAlertasVet().then(setAlertas),
    ]).then((results) => {
      const err = results.find((r) => r.status === 'rejected')
      if (err && err.status === 'rejected') {
        setError((err.reason as any)?.message ?? 'Error al cargar el panel')
      }
    }).finally(() => setLoading(false))
  }, [userId])

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  const nombre = (user as any)?.user_metadata?.nombre
    ?? (user as any)?.user_metadata?.full_name
    ?? user?.email
    ?? 'Veterinario'

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Panel</h1>
        <p className="text-sm text-slate-400 mt-0.5 truncate">{nombre}</p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <LayoutGrid size={15} />
            <span className="text-xs font-medium uppercase tracking-wide">Caballos</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{cantCaballos ?? '—'}</p>
          <p className="text-xs text-slate-400 mt-0.5">asignados</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Clock size={15} />
            <span className="text-xs font-medium uppercase tracking-wide">Alertas</span>
          </div>
          <p className={`text-3xl font-bold ${alertas.length > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
            {alertas.length}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">próximas consultas</p>
        </div>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-200">
            <AlertTriangle size={15} className="text-amber-500" />
            <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Próximas consultas
            </span>
          </div>
          <div className="divide-y divide-amber-100">
            {alertas.map((a) => {
              const { texto, clase } = diasLabel(a.dias_restantes)
              return (
                <button
                  key={a.historial_id}
                  onClick={() => navigate(`/caballos/${a.caballo_id}/historial`)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-50/60 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{a.caballo_nombre}</p>
                    {a.tipo && <p className="text-xs text-slate-400 truncate">{a.tipo}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${clase}`}>
                      {texto}
                    </span>
                    <ChevronRight size={14} className="text-slate-300" />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Últimas consultas */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          <ClipboardList size={15} className="text-slate-400" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Últimas consultas
          </span>
        </div>

        {consultas.length === 0 ? (
          <p className="px-4 py-8 text-sm text-slate-400 text-center">
            Aún no registraste consultas.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {consultas.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(`/caballos/${c.caballo_id}/historial`)}
                className="w-full flex items-start justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-400">{formatFecha(c.fecha_consulta)}</span>
                    <span className="text-xs font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      {c.tipo}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-800 mt-0.5 truncate">
                    {c.caballo_nombre}
                  </p>
                  {c.diagnostico && (
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                      {c.diagnostico}
                    </p>
                  )}
                </div>
                <ChevronRight size={14} className="text-slate-300 shrink-0 mt-1 ml-2" />
              </button>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
