import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Trophy, Users, LayoutGrid, CalendarDays, Trash2 } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { torneoService } from '../../services/torneoService'
import { mensajeError } from '../../utils/error'
import { LABEL_ESTADO_TORNEO, type EstadoTorneo, type Torneo } from '../../types/torneo'
import NuevoTorneoModal from '../../components/domain/NuevoTorneoModal'
import Spinner from '../../components/ui/Spinner'

const ESTADO_BADGE: Record<EstadoTorneo, string> = {
  activo:     'bg-emerald-100 text-emerald-700',
  finalizado: 'bg-slate-100 text-slate-500',
  cancelado:  'bg-red-50 text-red-500',
}

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

/** "12/03/26 → 18/03/26", "12/03/26" o la temporada si no hay fechas. */
function periodo(torneo: Torneo): string {
  if (torneo.fecha_inicio && torneo.fecha_fin) {
    return `${formatFecha(torneo.fecha_inicio)} → ${formatFecha(torneo.fecha_fin)}`
  }
  if (torneo.fecha_inicio) return formatFecha(torneo.fecha_inicio)
  return torneo.temporada ?? 'Sin fecha'
}

export default function TorneosPage() {
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const rol        = useAuthStore((s) => s.rol)
  const esAdmin    = rol === 'admin'
  const navigate   = useNavigate()

  const [torneos,   setTorneos]   = useState<Torneo[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [showNuevo, setShowNuevo] = useState(false)

  const cargar = useCallback(async () => {
    if (!sociedadId) return
    setLoading(true)
    setError(null)
    try {
      setTorneos(await torneoService.listar(sociedadId))
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setLoading(false)
    }
  }, [sociedadId])

  useEffect(() => { cargar() }, [cargar])

  const activos    = useMemo(() => torneos.filter((t) => t.estado === 'activo'), [torneos])
  const historicos = useMemo(() => torneos.filter((t) => t.estado !== 'activo'), [torneos])

  async function handleEliminar(torneo: Torneo) {
    const ok = window.confirm(
      `¿Eliminar el torneo "${torneo.nombre}"? Se pierden sus jugadores y asignaciones.`,
    )
    if (!ok) return
    try {
      await torneoService.eliminar(torneo.id)
      await cargar()
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto pb-24">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Torneos</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Organización de caballos por jugador para cada competencia
          </p>
        </div>
        {esAdmin && (
          <button
            onClick={() => setShowNuevo(true)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 px-3 py-2 text-sm font-medium text-white transition-colors"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Nuevo torneo</span>
          </button>
        )}
      </div>

      {loading && <div className="flex justify-center py-20"><Spinner size="lg" /></div>}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          Error: {error}
        </div>
      )}

      {!loading && !error && torneos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-sm">
          <Trophy size={28} className="mb-2 opacity-30" />
          {esAdmin
            ? 'Sin torneos todavía. Creá el primero con “Nuevo torneo”.'
            : 'Todavía no hay torneos cargados.'}
        </div>
      )}

      {!loading && !error && torneos.length > 0 && (
        <div className="space-y-6">
          {activos.length > 0 && (
            <Seccion titulo="En curso">
              {activos.map((t) => (
                <TorneoRow
                  key={t.id}
                  torneo={t}
                  esAdmin={esAdmin}
                  onEliminar={() => handleEliminar(t)}
                />
              ))}
            </Seccion>
          )}
          {historicos.length > 0 && (
            <Seccion titulo="Historial">
              {historicos.map((t) => (
                <TorneoRow
                  key={t.id}
                  torneo={t}
                  esAdmin={esAdmin}
                  onEliminar={() => handleEliminar(t)}
                />
              ))}
            </Seccion>
          )}
        </div>
      )}

      {showNuevo && (
        <NuevoTorneoModal
          onClose={() => setShowNuevo(false)}
          onSuccess={(id) => navigate(`/torneos/${id}`)}
        />
      )}
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{titulo}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function TorneoRow({
  torneo, esAdmin, onEliminar,
}: {
  torneo: Torneo
  esAdmin: boolean
  onEliminar: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 hover:border-slate-200">
      <Link to={`/torneos/${torneo.id}`} className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-900">{torneo.nombre}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ESTADO_BADGE[torneo.estado]}`}>
            {LABEL_ESTADO_TORNEO[torneo.estado]}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <CalendarDays size={12} />
            {periodo(torneo)}
          </span>
          <span className="flex items-center gap-1">
            <Users size={12} />
            {torneo.cantidad_jugadores ?? 0} jugador{(torneo.cantidad_jugadores ?? 0) === 1 ? '' : 'es'}
          </span>
          <span className="flex items-center gap-1">
            <LayoutGrid size={12} />
            {torneo.cantidad_asignados ?? 0} asignado{(torneo.cantidad_asignados ?? 0) === 1 ? '' : 's'}
          </span>
        </div>
      </Link>
      {esAdmin && (
        <button
          onClick={onEliminar}
          title="Eliminar torneo"
          className="rounded-lg p-2 text-slate-300 hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  )
}
