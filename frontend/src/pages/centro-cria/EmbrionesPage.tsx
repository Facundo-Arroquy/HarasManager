import { useCallback, useEffect, useState } from 'react'
import { FlaskConical, ArrowLeftRight, Plus } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useCrianzaStore } from '../../store/crianzaStore'
import { crianzaService } from '../../services/crianzaService'
import type { EmbrionConSeguimiento, EstadoEmbrion, ResultadoEcografia } from '../../types/crianza'
import Spinner from '../../components/ui/Spinner'
import TransferenciaModal from '../../components/centro-cria/TransferenciaModal'
import FlushingModal from '../../components/centro-cria/FlushingModal'

const ESTADO_LABEL: Record<EstadoEmbrion, string> = {
  disponible:  'Disponible',
  transferido: 'Transferido',
  congelado:   'Vitrificado',
  descartado:  'Descartado',
}

const FILTROS: Array<EstadoEmbrion | 'todos'> = ['todos', 'disponible', 'transferido', 'congelado', 'descartado']

const ECO_BADGE: Record<ResultadoEcografia, string> = {
  prenada:   'bg-emerald-100 text-emerald-700',
  abortada:  'bg-red-100     text-red-700',
  pendiente: 'bg-amber-100   text-amber-700',
}

const ECO_LABEL: Record<ResultadoEcografia, string> = {
  prenada:   'Preñada',
  abortada:  'Abortada',
  pendiente: 'Revisar',
}

const NUMEROS_ECO = [1, 2, 3]

function formatFecha(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y.slice(2)}`
}

const VACIO = <span className="text-slate-300">—</span>

export default function EmbrionesPage() {
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const rol        = useAuthStore((s) => s.rol)
  const { cargar, cargarParaVet } = useCrianzaStore()

  const [embriones, setEmbriones] = useState<EmbrionConSeguimiento[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filtro,    setFiltro]    = useState<EstadoEmbrion | 'todos'>('todos')

  const [embrionParaTransf,  setEmbrionParaTransf]  = useState<EmbrionConSeguimiento | null>(null)
  const [showNuevoFlushing,  setShowNuevoFlushing]  = useState(false)

  const puedeOperar = rol === 'veterinario' || rol === 'admin'

  const recargar = useCallback(() => {
    if (!sociedadId && rol !== 'veterinario') return
    setLoading(true)
    const promesa = sociedadId
      ? crianzaService.listarTodosEmbriones(sociedadId)
      : crianzaService.listarTodosEmbrionesVet()
    promesa
      .then(setEmbriones)
      .catch(() => setEmbriones([]))
      .finally(() => setLoading(false))
  }, [sociedadId, rol])

  useEffect(() => { recargar() }, [recargar])

  // El modal de transferencia usa las transferencias del store para avisar
  // cuando la receptora elegida ya recibió una.
  useEffect(() => {
    if (sociedadId) cargar(sociedadId)
    else if (rol === 'veterinario') cargarParaVet()
  }, [sociedadId, rol]) // eslint-disable-line react-hooks/exhaustive-deps

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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Embriones vitrificados</h1>
          <p className="text-sm text-slate-500 mt-0.5">Stock del centro, flushings y seguimiento de las transferencias</p>
        </div>
        {puedeOperar && (
          <button
            onClick={() => setShowNuevoFlushing(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md bg-brand-500 hover:bg-brand-400 text-white transition-colors shrink-0"
          >
            <Plus size={14} />
            Nuevo flushing
          </button>
        )}
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

      {/* Tabla — se desliza en horizontal con la receptora fija a la izquierda */}
      {embriones.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          <FlaskConical size={28} className="mx-auto mb-2 opacity-30" />
          Sin embriones registrados.
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
          <table className="text-sm w-max min-w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500 sticky left-0 z-10 bg-slate-50 border-r border-slate-200">Receptora</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap">Pelaje</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap">Fecha transferencia</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Madre</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Padre</th>
                {NUMEROS_ECO.map((n) => (
                  <th key={n} className="px-4 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap">Ecografía {n}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibles.map((e) => {
                // Un embrión se transfiere una sola vez; si nunca se transfirió
                // (disponible, vitrificado o descartado) no hay receptora.
                const transf = e.cria_transferencia?.[0]
                // Solo el stock vivo se puede transferir: los descartados no.
                const transferible = !transf && (e.estado === 'disponible' || e.estado === 'congelado')
                return (
                  <tr key={e.id} className="group hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800 sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200 whitespace-nowrap">
                      {transf?.receptora?.nombre ?? (
                        transferible && puedeOperar ? (
                          <div className="relative group/btn inline-block">
                            <button
                              onClick={() => rol === 'veterinario' && setEmbrionParaTransf(e)}
                              disabled={rol !== 'veterinario'}
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors bg-blue-100 text-blue-600 hover:bg-blue-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-100"
                            >
                              <ArrowLeftRight size={11} />
                              Transferir
                            </button>
                            {rol !== 'veterinario' && (
                              <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/btn:block z-20 pointer-events-none">
                                <div className="bg-slate-800 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap">
                                  Solo veterinarios pueden registrar transferencias
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          VACIO
                        )
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {transf?.receptora?.pelaje?.nombre ?? VACIO}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {transf ? formatFecha(transf.fecha) : VACIO}
                    </td>
                    <td className="px-4 py-3 text-slate-800 whitespace-nowrap">
                      {e.donante?.nombre ?? VACIO}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {e.padrillo?.nombre ?? VACIO}
                    </td>
                    {NUMEROS_ECO.map((n) => {
                      const eco = transf?.cria_ecografia?.find((x) => x.numero === n)
                      return (
                        <td key={n} className="px-4 py-3 whitespace-nowrap">
                          {eco ? (
                            <>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${ECO_BADGE[eco.resultado]}`}>
                                {ECO_LABEL[eco.resultado]}
                              </span>
                              <span className="block text-[11px] text-slate-400 mt-0.5">{formatFecha(eco.fecha)}</span>
                            </>
                          ) : (
                            VACIO
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {embrionParaTransf && (
        <TransferenciaModal
          embrionPreId={embrionParaTransf.id}
          donantePredId={embrionParaTransf.caballo_donante_id}
          padrilloPreId={embrionParaTransf.padrillo_id ?? undefined}
          flushingId={embrionParaTransf.flushing_id}
          sociedadId={embrionParaTransf.sociedad_id}
          onClose={() => setEmbrionParaTransf(null)}
          onSuccess={() => {
            setEmbrionParaTransf(null)
            recargar()
          }}
        />
      )}

      {showNuevoFlushing && (
        <FlushingModal
          onClose={() => setShowNuevoFlushing(false)}
          onSuccess={() => {
            setShowNuevoFlushing(false)
            recargar()
          }}
        />
      )}
    </div>
  )
}
