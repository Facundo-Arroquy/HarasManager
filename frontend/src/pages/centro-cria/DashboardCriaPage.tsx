import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Bell, Droplets, ArrowLeftRight, AlertCircle, CheckCircle, Clock, Plus } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useCrianzaStore } from '../../store/crianzaStore'
import Spinner from '../../components/ui/Spinner'
import RegistroCriaModal from '../../components/centro-cria/RegistroCriaModal'

export default function DashboardCriaPage() {
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const rol        = useAuthStore((s) => s.rol)
  const { registros, recordatorios, flushings, transferencias, loading, error, cargar, cargarParaVet, sincronizarVencidos } =
    useCrianzaStore()
  const [showModal, setShowModal] = useState(false)

  const sincronizadorRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function recargar() {
    if (sociedadId) cargar(sociedadId)
    else if (rol === 'veterinario') cargarParaVet()
  }

  useEffect(() => {
    recargar()
    sincronizadorRef.current = setInterval(() => sincronizarVencidos(), 60_000)
    return () => {
      if (sincronizadorRef.current) clearInterval(sincronizadorRef.current)
    }
  }, [sociedadId, rol]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-md bg-red-950 text-red-600 text-sm">
        <AlertCircle size={16} />
        {error}
      </div>
    )
  }

  const hoy = new Date().toISOString().split('T')[0]

  const pendientesHoy     = recordatorios.filter((r) => r.fecha_vto === hoy && r.estado === 'pendiente')
  const vencidos          = recordatorios.filter((r) => r.estado === 'vencido')
  const pendientesProx7   = recordatorios.filter(
    (r) => r.estado === 'pendiente' && r.fecha_vto > hoy && r.fecha_vto <= sumarDias(hoy, 7)
  )
  const flushingsRecientes = flushings.slice(0, 5)
  const transferenciasRecientes = transferencias.slice(0, 5)

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Centro de Embriones</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestión reproductiva del establecimiento</p>
        </div>
        {rol === 'veterinario' && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-brand-500 hover:bg-brand-400 text-sm font-medium text-white transition-colors shrink-0"
          >
            <Plus size={15} />
            Nuevo registro
          </button>
        )}
      </div>

      {showModal && rol === 'veterinario' && (
        <RegistroCriaModal
          onClose={() => setShowModal(false)}
          onSuccess={recargar}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Hoy"
          value={pendientesHoy.length}
          sub={`${pendientesHoy.length === 1 ? 'recordatorio' : 'recordatorios'}`}
          icon={<Bell size={16} />}
          accent={pendientesHoy.length > 0 ? 'brand' : 'zinc'}
          to="/centro-cria/recordatorios"
        />
        <StatCard
          label="Vencidos"
          value={vencidos.length}
          sub="sin resolver"
          icon={<AlertCircle size={16} />}
          accent={vencidos.length > 0 ? 'red' : 'zinc'}
          to="/centro-cria/recordatorios"
        />
        <StatCard
          label="Flushings"
          value={flushings.filter((f) => !f.cancelado).length}
          sub="registros totales"
          icon={<Droplets size={16} />}
          accent="zinc"
          to="/centro-cria/flushings"
        />
        <StatCard
          label="Transferencias"
          value={transferencias.length}
          sub="registros totales"
          icon={<ArrowLeftRight size={16} />}
          accent="zinc"
          to="/centro-cria/transferencias"
        />
      </div>

      {/* Alertas de vencidos */}
      {vencidos.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 space-y-2">
          <p className="text-sm font-medium text-red-600 flex items-center gap-2">
            <AlertCircle size={15} />
            {vencidos.length} {vencidos.length === 1 ? 'recordatorio vencido' : 'recordatorios vencidos'}
          </p>
          <ul className="space-y-1">
            {vencidos.slice(0, 4).map((r) => (
              <li key={r.id} className="text-xs text-slate-500 flex items-center gap-2">
                <span className="text-red-500">•</span>
                <span className="font-medium text-slate-600">{r.caballo?.nombre ?? '—'}</span>
                <span>{r.tipo}</span>
                <span className="text-slate-400">{formatFecha(r.fecha_vto)}</span>
              </li>
            ))}
            {vencidos.length > 4 && (
              <li className="text-xs text-slate-400">+{vencidos.length - 4} más</li>
            )}
          </ul>
        </div>
      )}

      {/* Próximos 7 días */}
      {pendientesProx7.length > 0 && (
        <Section title="Próximos 7 días" icon={<CalendarDays size={15} />}>
          <ul className="divide-y divide-slate-200">
            {pendientesProx7.slice(0, 6).map((r) => (
              <RecordatorioRow key={r.id} recordatorio={r} />
            ))}
          </ul>
          {pendientesProx7.length > 6 && (
            <Link
              to="/centro-cria/recordatorios"
              className="block text-xs text-slate-400 hover:text-slate-600 px-4 py-2"
            >
              Ver todos ({pendientesProx7.length}) →
            </Link>
          )}
        </Section>
      )}

      {/* Flushings recientes */}
      {flushingsRecientes.length > 0 && (
        <Section title="Últimos flushings" icon={<Droplets size={15} />}>
          <ul className="divide-y divide-slate-200">
            {flushingsRecientes.map((f) => (
              <li key={f.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                <span className="font-medium text-slate-700">{f.caballo?.nombre ?? '—'}</span>
                <span className="text-slate-400">{formatFecha(f.fecha)}</span>
                {f.es_negativo ? (
                  <span className="text-xs text-slate-400">Negativo</span>
                ) : (
                  <span className="text-xs text-brand-600">{f.cantidad} embrión{f.cantidad !== 1 ? 'es' : ''}</span>
                )}
                {f.cancelado && (
                  <span className="text-xs text-slate-400">Cancelado</span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Transferencias recientes */}
      {transferenciasRecientes.length > 0 && (
        <Section title="Últimas transferencias" icon={<ArrowLeftRight size={15} />}>
          <ul className="divide-y divide-slate-200">
            {transferenciasRecientes.map((t) => (
              <li key={t.id} className="px-4 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-700">{t.receptora?.nombre ?? '—'}</span>
                  <span className="text-slate-400">←</span>
                  <span className="text-slate-500">{t.donante?.nombre ?? '—'}</span>
                  {t.padrillo && (
                    <>
                      <span className="text-slate-400">×</span>
                      <span className="text-slate-500">{t.padrillo.nombre}</span>
                    </>
                  )}
                  <span className="ml-auto text-slate-400 text-xs">{formatFecha(t.fecha)}</span>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Estado vacío */}
      {registros.length === 0 && recordatorios.length === 0 && (
        <div className="text-center py-16 text-slate-400 text-sm">
          <Droplets size={32} className="mx-auto mb-3 opacity-30" />
          <p>Sin registros reproductivos aún.</p>
          <p className="text-xs mt-1">Comenzá registrando una revisión en Programa Semanal.</p>
        </div>
      )}
    </div>
  )
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, accent, to,
}: {
  label: string
  value: number
  sub: string
  icon: React.ReactNode
  accent: 'zinc' | 'brand' | 'red' | 'emerald'
  to: string
}) {
  const colorMap = {
    zinc:    'text-slate-500',
    brand:   'text-brand-600',
    red:     'text-red-600',
    emerald: 'text-brand-600',
  }
  return (
    <Link
      to={to}
      className="rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 transition-colors"
    >
      <div className={`flex items-center gap-1.5 text-xs mb-2 ${colorMap[accent]}`}>
        {icon}
        {label}
      </div>
      <p className={`text-2xl font-semibold ${colorMap[accent]}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </Link>
  )
}

function Section({
  title, icon, children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 text-sm text-slate-500">
        {icon}
        {title}
      </div>
      {children}
    </div>
  )
}

function RecordatorioRow({ recordatorio: r }: { recordatorio: { id: string; caballo?: { nombre: string } | null; tipo: string; fecha_vto: string; estado: string } }) {
  const esHoy = r.fecha_vto === new Date().toISOString().split('T')[0]
  return (
    <li className="px-4 py-2.5 flex items-center gap-3 text-sm">
      {r.estado === 'hecho' ? (
        <CheckCircle size={14} className="text-brand-500 shrink-0" />
      ) : (
        <Clock size={14} className={`shrink-0 ${esHoy ? 'text-brand-600' : 'text-slate-400'}`} />
      )}
      <span className="font-medium text-slate-700 truncate">{r.caballo?.nombre ?? '—'}</span>
      <span className={`text-slate-500 ${esHoy ? 'font-medium text-brand-700' : ''}`}>{r.tipo}</span>
      <span className="ml-auto text-xs text-slate-400 shrink-0">{formatFecha(r.fecha_vto)}</span>
    </li>
  )
}

// ── Utilidades locales ───────────────────────────────────────────────────────

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(fecha + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().split('T')[0]
}

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y.slice(2)}`
}
