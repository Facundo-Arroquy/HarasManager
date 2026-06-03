import { useEffect, useState } from 'react'
import { Bell, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useCrianzaStore } from '../../store/crianzaStore'
import type { RecordatorioCria, EstadoRecordatorio } from '../../types/crianza'
import Spinner from '../../components/ui/Spinner'
import FlushingModal from '../../components/centro-cria/FlushingModal'
import TransferenciaModal from '../../components/centro-cria/TransferenciaModal'

const FILTROS: { label: string; value: EstadoRecordatorio | 'todos' }[] = [
  { label: 'Todos',      value: 'todos' },
  { label: 'Pendientes', value: 'pendiente' },
  { label: 'Vencidos',   value: 'vencido' },
  { label: 'Hechos',     value: 'hecho' },
  { label: 'Cancelados', value: 'cancelado' },
]

export default function RecordatoriosPage() {
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const rol        = useAuthStore((s) => s.rol)
  const { recordatorios, loading, cargar, cargarParaVet, actualizarEstadoRecordatorio } = useCrianzaStore()
  const [filtro, setFiltro] = useState<EstadoRecordatorio | 'todos'>('pendiente')
  const [cancelando, setCancelando] = useState<string | null>(null)
  const [flushingRec, setFlushingRec] = useState<RecordatorioCria | null>(null)
  const [flushingParaTransf, setFlushingParaTransf] = useState<{ id: string; sociedadId: string } | null>(null)

  useEffect(() => {
    if (sociedadId) cargar(sociedadId)
    else if (rol === 'veterinario') cargarParaVet()
  }, [sociedadId, rol]) // eslint-disable-line react-hooks/exhaustive-deps

  const lista = filtro === 'todos'
    ? recordatorios
    : recordatorios.filter((r) => r.estado === filtro)

  const listaOrdenada = [...lista].sort((a, b) => a.fecha_vto.localeCompare(b.fecha_vto))

  function marcarHecho(r: RecordatorioCria) {
    if (r.tipo === 'Flushing') {
      setFlushingRec(r)
    } else {
      actualizarEstadoRecordatorio(r.id, 'hecho')
    }
  }

  async function cancelar(id: string) {
    await actualizarEstadoRecordatorio(id, 'cancelado')
    setCancelando(null)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="space-y-5 p-1">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Recordatorios</h1>
        <p className="text-sm text-slate-500 mt-0.5">Seguimiento del ciclo reproductivo</p>
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
                  ? 'bg-slate-200 text-slate-900'
                  : 'bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}
            >
              {f.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                filtro === f.value ? 'bg-slate-400' : 'bg-slate-100'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Lista */}
      {listaOrdenada.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          <Bell size={28} className="mx-auto mb-2 opacity-30" />
          No hay recordatorios en esta categoría.
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden divide-y divide-slate-200">
          {listaOrdenada.map((r) => (
            <RecordatorioItem
              key={r.id}
              recordatorio={r}
              canEdit={rol === 'veterinario'}
              onHecho={() => marcarHecho(r)}
              onCancelar={() => cancelar(r.id)}
              cancelando={cancelando === r.id}
              setCancelando={() => setCancelando(cancelando === r.id ? null : r.id)}
            />
          ))}
        </div>
      )}

      {/* Modal flushing (cuando tipo === 'Flushing') */}
      {flushingRec && (
        <FlushingModal
          recordatorio={flushingRec}
          onClose={() => setFlushingRec(null)}
          onSuccess={(flushingId) => {
            const sid = flushingRec?.sociedad_id ?? ''
            setFlushingRec(null)
            setFlushingParaTransf({ id: flushingId, sociedadId: sid })
          }}
        />
      )}

      {/* Modal transferencia encadenado tras flushing positivo */}
      {flushingParaTransf && (
        <TransferenciaModal
          flushingId={flushingParaTransf.id}
          sociedadId={flushingParaTransf.sociedadId}
          onClose={() => setFlushingParaTransf(null)}
          onSuccess={() => setFlushingParaTransf(null)}
        />
      )}
    </div>
  )
}

function RecordatorioItem({
  recordatorio: r,
  canEdit = true,
  onHecho,
  onCancelar,
  cancelando,
  setCancelando,
}: {
  recordatorio: RecordatorioCria
  canEdit?: boolean
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
        {r.estado === 'hecho' && <CheckCircle size={16} className="text-brand-500" />}
        {r.estado === 'cancelado' && <XCircle size={16} className="text-slate-400" />}
        {r.estado === 'vencido' && <AlertCircle size={16} className="text-red-600" />}
        {r.estado === 'pendiente' && (
          <Clock size={16} className={esHoy ? 'text-brand-600' : 'text-slate-400'} />
        )}
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-slate-700 text-sm">{r.caballo?.nombre ?? '—'}</span>
          <span className={`text-sm ${esHoy && activo ? 'text-brand-700 font-medium' : 'text-slate-500'}`}>
            {r.tipo}
          </span>
          {r.auto_generado && (
            <span className="text-[10px] text-slate-400 border border-slate-300 rounded px-1">auto</span>
          )}
        </div>
        <p className={`text-xs mt-0.5 ${
          r.estado === 'vencido' ? 'text-red-600' :
          esHoy && activo       ? 'text-brand-600' :
          esPasado && activo    ? 'text-red-600' :
          'text-slate-400'
        }`}>
          {formatFecha(r.fecha_vto)}
          {esHoy && activo && ' — Hoy'}
        </p>
        {r.notas && <p className="text-xs text-slate-400 mt-1">{r.notas}</p>}
        {r.cancel_motivo && (
          <p className="text-xs text-slate-400 mt-1">Cancelado: {r.cancel_motivo}</p>
        )}
      </div>

      {/* Acciones */}
      {activo && canEdit && (
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onHecho}
            className="text-xs px-2.5 py-1 rounded bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors"
          >
            Hecho
          </button>
          {cancelando ? (
            <div className="flex items-center gap-1">
              <button
                onClick={onCancelar}
                className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              >
                Confirmar
              </button>
              <button
                onClick={setCancelando}
                className="text-xs px-2 py-1 rounded text-slate-400 hover:text-slate-600 transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={setCancelando}
              className="text-xs px-2.5 py-1 rounded bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
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
