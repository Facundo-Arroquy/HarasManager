import { useEffect, useState } from 'react'
import { Droplets, ArrowLeftRight } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useCrianzaStore } from '../../store/crianzaStore'
import type { Flushing } from '../../types/crianza'
import Spinner from '../../components/ui/Spinner'
import TransferenciaModal from '../../components/centro-cria/TransferenciaModal'

export default function FlushingsPage() {
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const { flushings, loading, cargar } = useCrianzaStore()
  const [flushingParaTransf, setFlushingParaTransf] = useState<Flushing | null>(null)

  useEffect(() => {
    if (sociedadId && flushings.length === 0) cargar(sociedadId)
  }, [sociedadId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  const activos = flushings.filter((f) => !f.cancelado)
  const totalEmbriones = activos.reduce((acc, f) => acc + (f.cantidad ?? 0), 0)
  const negativos = activos.filter((f) => f.es_negativo).length

  return (
    <div className="space-y-5 p-1">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Flushings</h1>
        <p className="text-sm text-zinc-400 mt-0.5">Registros de recuperación embrionaria</p>
      </div>

      {/* Resumen */}
      {activos.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-center">
            <p className="text-xl font-semibold text-zinc-100">{activos.length}</p>
            <p className="text-xs text-zinc-500 mt-0.5">Procedimientos</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-center">
            <p className="text-xl font-semibold text-emerald-400">{totalEmbriones}</p>
            <p className="text-xs text-zinc-500 mt-0.5">Embriones totales</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-center">
            <p className="text-xl font-semibold text-zinc-400">{negativos}</p>
            <p className="text-xs text-zinc-500 mt-0.5">Negativos</p>
          </div>
        </div>
      )}

      {flushings.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 text-sm">
          <Droplets size={28} className="mx-auto mb-2 opacity-30" />
          Sin flushings registrados.
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden divide-y divide-zinc-800">
          {flushings.map((f) => (
            <div
              key={f.id}
              className={`px-4 py-3 text-sm ${f.cancelado ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-zinc-100">{f.caballo?.nombre ?? '—'}</span>
                    {f.padrillo && (
                      <>
                        <span className="text-zinc-600">×</span>
                        <span className="text-zinc-400">{f.padrillo.nombre}</span>
                      </>
                    )}
                    {f.cancelado && (
                      <span className="text-xs border border-zinc-700 rounded px-1.5 text-zinc-500">Cancelado</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-zinc-500">
                    {f.es_negativo ? (
                      <span className="text-zinc-500">Negativo</span>
                    ) : (
                      <>
                        {f.cantidad != null && (
                          <span className="text-emerald-400 font-medium">
                            {f.cantidad} {f.cantidad === 1 ? 'embrión' : 'embriones'}
                          </span>
                        )}
                        {f.estadio && <span>{f.estadio}</span>}
                        {f.grado != null && <span>Grado {f.grado}</span>}
                        {f.tamanio && <span>{f.tamanio}</span>}
                      </>
                    )}
                    {f.veterinario && <span>Dr/a. {f.veterinario.apellido}</span>}
                  </div>

                  {f.notas && <p className="text-xs text-zinc-500 mt-1">{f.notas}</p>}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-xs text-zinc-500">{formatFecha(f.fecha)}</span>
                  {!f.cancelado && !f.es_negativo && (
                    <button
                      onClick={() => setFlushingParaTransf(f)}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-900/40 text-blue-400 hover:bg-blue-900/70 transition-colors"
                    >
                      <ArrowLeftRight size={11} />
                      Transferir
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {flushingParaTransf && (
        <TransferenciaModal
          flushing={flushingParaTransf}
          onClose={() => setFlushingParaTransf(null)}
          onSuccess={() => setFlushingParaTransf(null)}
        />
      )}
    </div>
  )
}

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y.slice(2)}`
}
