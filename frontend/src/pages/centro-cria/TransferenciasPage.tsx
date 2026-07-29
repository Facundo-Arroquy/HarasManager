import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, Plus, Activity } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useCrianzaStore } from '../../store/crianzaStore'
import EcografiaModal from '../../components/centro-cria/EcografiaModal'
import Spinner from '../../components/ui/Spinner'
import { LABEL_RESULTADO_ECO } from '../../types/crianza'
import type { Ecografia, ResultadoEcografia, TransferenciaEmbrionaria } from '../../types/crianza'

const RESULTADO_BADGE: Record<ResultadoEcografia, string> = {
  prenada:   'bg-emerald-100 text-emerald-700',
  abortada:  'bg-red-100 text-red-700',
  pendiente: 'bg-amber-100 text-amber-700',
}

export default function TransferenciasPage() {
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const rol        = useAuthStore((s) => s.rol)
  const esVet      = rol === 'veterinario'
  const { transferencias, ecografias, loading, cargar, cargarParaVet } = useCrianzaStore()

  const [modalTransferencia, setModalTransferencia] = useState<TransferenciaEmbrionaria | null>(null)

  useEffect(() => {
    if (sociedadId && transferencias.length === 0) cargar(sociedadId)
    else if (!sociedadId && rol === 'veterinario' && transferencias.length === 0) cargarParaVet()
  }, [sociedadId, rol]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ecografías agrupadas por transferencia (ordenadas por número)
  const ecosPorTransferencia = useMemo(() => {
    const map: Record<string, Ecografia[]> = {}
    for (const e of ecografias) {
      if (!map[e.transferencia_id]) map[e.transferencia_id] = []
      map[e.transferencia_id].push(e)
    }
    for (const id of Object.keys(map)) {
      map[id].sort((a, b) => a.numero - b.numero)
    }
    return map
  }, [ecografias])

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="space-y-5 p-1">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Transferencias de embriones</h1>
        <p className="text-sm text-slate-500 mt-0.5">Historial de transferencias embrionarias y sus ecografías</p>
      </div>

      {transferencias.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          <ArrowLeftRight size={28} className="mx-auto mb-2 opacity-30" />
          Sin transferencias registradas.
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden divide-y divide-slate-200">
          {transferencias.map((t) => {
            const ecos = ecosPorTransferencia[t.id] ?? []
            // Si una eco dio "abortada", el ciclo terminó: no se agregan más ecos.
            const abortada = ecos.some((e) => e.resultado === 'abortada')
            return (
              <div key={t.id} className="px-4 py-3 text-sm">
                <div className="flex items-start gap-2 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900">{t.receptora?.nombre ?? '—'}</span>
                      <span className="text-slate-400">←</span>
                      <span className="text-slate-600">{t.donante?.nombre ?? '—'}</span>
                      {t.padrillo && (
                        <>
                          <span className="text-slate-400">×</span>
                          <span className="text-slate-500">{t.padrillo.nombre}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-slate-400">
                      {t.clasificacion && (
                        <span className="border border-slate-300 rounded px-1.5 py-0.5 text-slate-500">
                          {t.clasificacion}
                        </span>
                      )}
                      {t.cl_calidad && <span>CL {t.cl_calidad}</span>}
                      {t.tono_uterino && <span>Útero {t.tono_uterino}</span>}
                      {t.veterinario && (
                        <span>Dr/a. {t.veterinario.apellido}</span>
                      )}
                    </div>
                    {t.notas && <p className="text-xs text-slate-400 mt-1">{t.notas}</p>}

                    {/* Ecografías */}
                    {ecos.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {ecos.map((e) => (
                          <span
                            key={e.id}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${RESULTADO_BADGE[e.resultado]}`}
                            title={`${formatFecha(e.fecha)}${e.notas ? ` · ${e.notas}` : ''}`}
                          >
                            <Activity size={10} />
                            Eco {e.numero}: {LABEL_RESULTADO_ECO[e.resultado]}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-xs text-slate-400">{formatFecha(t.fecha)}</span>
                    {esVet && !abortada && (
                      <button
                        onClick={() => setModalTransferencia(t)}
                        className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-brand-400 hover:text-brand-600 transition-colors"
                      >
                        <Plus size={12} />
                        Ecografía
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalTransferencia && (
        <EcografiaModal
          transferencia={modalTransferencia}
          ecografiasExistentes={ecosPorTransferencia[modalTransferencia.id] ?? []}
          onClose={() => setModalTransferencia(null)}
          onSuccess={() => setModalTransferencia(null)}
        />
      )}
    </div>
  )
}

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y.slice(2)}`
}
