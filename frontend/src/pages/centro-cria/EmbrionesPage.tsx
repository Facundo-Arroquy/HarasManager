import { useEffect, useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { crianzaService } from '../../services/crianzaService'
import type { Embrion, EstadoEmbrion } from '../../types/crianza'
import Spinner from '../../components/ui/Spinner'

type EmbrionConTransf = Embrion & {
  cria_transferencia?: Array<{
    fecha: string
    receptora: { nombre: string } | null
  }>
}

const ESTADO_BADGE: Record<EstadoEmbrion, string> = {
  disponible:  'bg-emerald-100 text-emerald-700',
  transferido: 'bg-blue-100   text-blue-700',
  congelado:   'bg-cyan-100   text-cyan-700',
  descartado:  'bg-slate-100  text-slate-500',
}

const ESTADO_LABEL: Record<EstadoEmbrion, string> = {
  disponible:  'Disponible',
  transferido: 'Transferido',
  congelado:   'Congelado',
  descartado:  'Descartado',
}

const FILTROS: Array<EstadoEmbrion | 'todos'> = ['todos', 'disponible', 'transferido', 'congelado', 'descartado']

function formatFecha(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y.slice(2)}`
}

export default function EmbrionesPage() {
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const rol        = useAuthStore((s) => s.rol)

  const [embriones, setEmbriones] = useState<EmbrionConTransf[]>([])
  const [loading,   setLoading]   = useState(false)
  const [filtro,    setFiltro]    = useState<EstadoEmbrion | 'todos'>('todos')

  useEffect(() => {
    if (!sociedadId && rol !== 'veterinario') return
    const sid = sociedadId ?? ''
    if (!sid) return
    setLoading(true)
    crianzaService.listarTodosEmbriones(sid)
      .then((data) => setEmbriones(data as EmbrionConTransf[]))
      .catch(() => setEmbriones([]))
      .finally(() => setLoading(false))
  }, [sociedadId, rol])

  const visibles = filtro === 'todos'
    ? embriones
    : embriones.filter((e) => e.estado === filtro)

  const counts = embriones.reduce<Record<string, number>>((acc, e) => {
    acc[e.estado] = (acc[e.estado] ?? 0) + 1
    return acc
  }, {})

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="space-y-5 p-1">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Embriones</h1>
        <p className="text-sm text-slate-500 mt-0.5">Stock de embriones del centro</p>
      </div>

      {/* Resumen */}
      {embriones.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {(['disponible', 'transferido', 'congelado', 'descartado'] as EstadoEmbrion[]).map((e) => (
            <div key={e} className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <p className={`text-xl font-semibold ${e === 'disponible' ? 'text-emerald-600' : e === 'transferido' ? 'text-blue-600' : 'text-slate-500'}`}>
                {counts[e] ?? 0}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{ESTADO_LABEL[e]}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      {embriones.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {FILTROS.map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                filtro === f
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-500 border-slate-300 hover:border-slate-400'
              }`}
            >
              {f === 'todos' ? `Todos (${embriones.length})` : `${ESTADO_LABEL[f]} (${counts[f] ?? 0})`}
            </button>
          ))}
        </div>
      )}

      {/* Tabla */}
      {embriones.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          <FlaskConical size={28} className="mx-auto mb-2 opacity-30" />
          Sin embriones registrados.
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Estado</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Madre</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Padre</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Estadio</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Grado</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Tamaño</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Receptora</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibles.map((e) => {
                const transf = e.cria_transferencia?.[0]
                return (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${ESTADO_BADGE[e.estado]}`}>
                        {ESTADO_LABEL[e.estado]}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {(e.donante as any)?.nombre ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {(e.padrillo as any)?.nombre ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {e.estadio ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-center">
                      {e.grado != null ? `G${e.grado}` : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {e.tamanio ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {transf?.receptora?.nombre ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {formatFecha(e.created_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
