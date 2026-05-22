import { useEffect, useState } from 'react'
import { Bell, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useCrianzaStore } from '../../store/crianzaStore'
import type { RecordatorioCria, EstadoRecordatorio } from '../../types/crianza'
import Spinner from '../../components/ui/Spinner'

const FILTROS: { label: string; value: EstadoRecordatorio | 'todos' }[] = [
  { label: 'Todos',      value: 'todos' },
  { label: 'Pendientes', value: 'pendiente' },
  { label: 'Vencidos',   value: 'vencido' },
  { label: 'Hechos',     value: 'hecho' },
  { label: 'Cancelados', value: 'cancelado' },
]

export default function RecordatoriosPage() {
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const { recordatorios, loading, cargar, actualizarEstadoRecordatorio } = useCrianzaStore()
  const [filtro, setFiltro] = useState<EstadoRecordatorio | 'todos'>('pendiente')
  const [cancelando, setCancelando] = useState<string | null>(null)

  useEffect(() => {
    if (sociedadId && recordatorios.length === 0) cargar(sociedadId)
  }, [sociedadId]) // eslint-disable-line react-hooks/exhaustive-deps

  const lista = filtro === 'todos'
    ? recordatorios
    : recordatorios.filter((r) => r.estado === filtro)

  const listaOrdenada = [...lista].sort((a, b) => a.fecha_vto.localeCompare(b.fecha_vto))

  async function marcarHecho(id: string) {
    await actualizarEstadoRecordatorio(id, 'hecho')
  }

  async function cancelar(id: string) {
    await actualizarEstadoRecordatorio(id, 'cancelado')
    setCancelando(null)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="space-y-5 p-1">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Recordatorios</h1>
        <p className="text-sm text-zinc-400 mt-0.5">Seguimiento del ciclo reproductivo</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-1.5">
        {FILTROS.map((f) => {
          const count = f.value === 'todos'
            ? recordatorios.length
            : recordatorios.filter((r) => r.estado === f.value).length
          return (
            <button
              key={f.value}
              onClick={() => setFiltro(f.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                filtro === f.value
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              {f.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                filtro === f.value ? 'bg-zinc-600' : 'bg-zinc-800'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Lista */}
      {listaOrdenada.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 text-sm">
          <Bell size={28} className="mx-auto mb-2 opacity-30" />
          No hay recordatorios en esta categoría.
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden divide-y divide-zinc-800">
          {listaOrdenada.map((r) => (
            <RecordatorioItem
              key={r.id}
              recordatorio={r}
              onHecho={() => marcarHecho(r.id)}
              onCancelar={() => cancelar(r.id)}
              cancelando={cancelando === r.id}
              setCancelando={() => setCancelando(cancelando === r.id ? null : r.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RecordatorioItem({
  recordatorio: r,
  onHecho,
  onCancelar,
  cancelando,
  setCancelando,
}: {
  recordatorio: RecordatorioCria
  onHecho: () => void
  onCancelar: () => void
  cancelando: boolean
  setCancelando: () => void
}) {
  const hoy = new Date().toISOString().split('T')[0]
  const esHoy    = r.fecha_vto === hoy
  const esPasado = r.fecha_vto < hoy
  const activo   = r.estado === 'pendiente' || r.estado === 'vencido'

  return (
    <div className="px-4 py-3 flex items-start gap-3">
      {/* Ícono estado */}
      <div className="mt-0.5 shrink-0">
        {r.estado === 'hecho' && <CheckCircle size={16} className="text-emerald-500" />}
        {r.estado === 'cancelado' && <XCircle size={16} className="text-zinc-600" />}
        {r.estado === 'vencido' && <AlertCircle size={16} className="text-red-400" />}
        {r.estado === 'pendiente' && (
          <Clock size={16} className={esHoy ? 'text-amber-400' : 'text-zinc-500'} />
        )}
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-zinc-200 text-sm">{r.caballo?.nombre ?? '—'}</span>
          <span className={`text-sm ${esHoy && activo ? 'text-amber-300 font-medium' : 'text-zinc-400'}`}>
            {r.tipo}
          </span>
          {r.auto_generado && (
            <span className="text-[10px] text-zinc-600 border border-zinc-700 rounded px-1">auto</span>
          )}
        </div>
        <p className={`text-xs mt-0.5 ${
          r.estado === 'vencido' ? 'text-red-400' :
          esHoy && activo       ? 'text-amber-400' :
          esPasado && activo    ? 'text-red-400' :
          'text-zinc-500'
        }`}>
          {formatFecha(r.fecha_vto)}
          {esHoy && activo && ' — Hoy'}
        </p>
        {r.notas && <p className="text-xs text-zinc-500 mt-1">{r.notas}</p>}
        {r.cancel_motivo && (
          <p className="text-xs text-zinc-600 mt-1">Cancelado: {r.cancel_motivo}</p>
        )}
      </div>

      {/* Acciones */}
      {activo && (
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onHecho}
            className="text-xs px-2.5 py-1 rounded bg-emerald-900/50 text-emerald-400 hover:bg-emerald-900 transition-colors"
          >
            Hecho
          </button>
          {cancelando ? (
            <div className="flex items-center gap-1">
              <button
                onClick={onCancelar}
                className="text-xs px-2 py-1 rounded bg-red-900/50 text-red-400 hover:bg-red-900 transition-colors"
              >
                Confirmar
              </button>
              <button
                onClick={setCancelando}
                className="text-xs px-2 py-1 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={setCancelando}
              className="text-xs px-2.5 py-1 rounded bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y.slice(2)}`
}
