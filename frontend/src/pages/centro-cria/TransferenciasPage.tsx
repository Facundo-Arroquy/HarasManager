import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, Plus, Activity, Trash2, X, Pencil } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useCrianzaStore } from '../../store/crianzaStore'
import { crianzaService } from '../../services/crianzaService'
import { mensajeError } from '../../utils/error'
import EcografiaModal from '../../components/centro-cria/EcografiaModal'
import EditarTransferenciaModal from '../../components/centro-cria/EditarTransferenciaModal'
import NombreCaballoLink from '../../components/domain/NombreCaballoLink'
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
  const userId     = useAuthStore((s) => s.user?.id)
  const esVet      = rol === 'veterinario'
  const { transferencias, ecografias, loading, cargar, cargarParaVet } = useCrianzaStore()

  const [modalTransferencia, setModalTransferencia] = useState<TransferenciaEmbrionaria | null>(null)
  const [borrandoId, setBorrandoId] = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [transfEditar, setTransfEditar] = useState<TransferenciaEmbrionaria | null>(null)
  const [ecoEditar, setEcoEditar] = useState<{
    eco: Ecografia
    transferencia: TransferenciaEmbrionaria
    esUltima: boolean
  } | null>(null)

  function recargar() {
    if (sociedadId) cargar(sociedadId)
    else if (esVet) cargarParaVet()
  }

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

  async function ejecutarBorrado(id: string, accion: () => Promise<void>, fallo: string) {
    setBorrandoId(id)
    setError(null)
    try {
      await accion()
      if (sociedadId) await cargar(sociedadId)
      else if (esVet) await cargarParaVet()
    } catch (e) {
      setError(mensajeError(e, fallo))
    } finally {
      setBorrandoId(null)
    }
  }

  function eliminarTransferencia(t: TransferenciaEmbrionaria) {
    const ok = window.confirm(
      `¿Eliminar la transferencia a ${t.receptora?.nombre ?? 'la receptora'} del ${formatFecha(t.fecha)}?\n\n` +
      'El embrión vuelve a quedar disponible, se deshace la preñez de la receptora y se borran ' +
      'sus recordatorios de ecografía pendientes. No se puede deshacer.',
    )
    if (!ok) return
    ejecutarBorrado(t.id, () => crianzaService.eliminarTransferencia(t.id), 'No se pudo eliminar la transferencia.')
  }

  function eliminarEcografia(e: Ecografia, receptora?: string) {
    const ok = window.confirm(
      `¿Eliminar la Eco ${e.numero} de ${receptora ?? 'la receptora'} (${formatFecha(e.fecha)})?\n\n` +
      (e.resultado === 'abortada' ? 'La receptora vuelve a quedar preñada. ' : '') +
      'Si la eco había cerrado un recordatorio, vuelve a quedar pendiente. ' +
      'El estado en el pipeline reproductivo no se toca.',
    )
    if (!ok) return
    ejecutarBorrado(e.id, () => crianzaService.eliminarEcografia(e.id), 'No se pudo eliminar la ecografía.')
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="space-y-5 p-1">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Transferencias de embriones</h1>
        <p className="text-sm text-slate-500 mt-0.5">Historial de transferencias embrionarias y sus ecografías</p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

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
            const ultimaEco = ecos[ecos.length - 1]
            // Se borra de atrás para adelante: primero las ecos, después la transferencia.
            const puedeBorrarTransf = t.veterinario_id === userId && ecos.length === 0
            return (
              <div key={t.id} className="px-4 py-3 text-sm">
                <div className="flex items-start gap-2 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <NombreCaballoLink
                        id={t.caballo_receptora_id}
                        nombre={t.receptora?.nombre}
                        className="font-medium text-slate-900"
                      />
                      <span className="text-slate-400">←</span>
                      <NombreCaballoLink
                        id={t.caballo_donante_id}
                        nombre={t.donante?.nombre}
                        className="text-slate-600"
                      />
                      {t.padrillo && (
                        <>
                          <span className="text-slate-400">×</span>
                          <NombreCaballoLink
                            id={t.padrillo_id}
                            nombre={t.padrillo.nombre}
                            className="text-slate-500"
                          />
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
                            {e.veterinario_id === userId ? (
                              <button
                                type="button"
                                onClick={() => setEcoEditar({ eco: e, transferencia: t, esUltima: e.id === ultimaEco?.id })}
                                title={`Editar la Eco ${e.numero}`}
                                className="hover:underline"
                              >
                                Eco {e.numero}: {LABEL_RESULTADO_ECO[e.resultado]}
                              </button>
                            ) : (
                              <>Eco {e.numero}: {LABEL_RESULTADO_ECO[e.resultado]}</>
                            )}
                            {e.id === ultimaEco?.id && e.veterinario_id === userId && (
                              <button
                                type="button"
                                onClick={() => eliminarEcografia(e, t.receptora?.nombre)}
                                disabled={borrandoId === e.id}
                                title={`Eliminar la Eco ${e.numero}`}
                                aria-label={`Eliminar la Eco ${e.numero}`}
                                className="ml-0.5 rounded-full p-px transition-colors hover:bg-black/10 disabled:opacity-50"
                              >
                                <X size={10} />
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-400">{formatFecha(t.fecha)}</span>
                      {t.veterinario_id === userId && (
                        <button
                          type="button"
                          onClick={() => setTransfEditar(t)}
                          title="Editar la transferencia"
                          aria-label="Editar la transferencia"
                          className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-600"
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                      {puedeBorrarTransf && (
                        <button
                          type="button"
                          onClick={() => eliminarTransferencia(t)}
                          disabled={borrandoId === t.id}
                          title="Eliminar la transferencia"
                          aria-label="Eliminar la transferencia"
                          className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          {borrandoId === t.id ? <Spinner size="sm" /> : <Trash2 size={13} />}
                        </button>
                      )}
                    </div>
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

      {ecoEditar && (
        <EcografiaModal
          transferencia={ecoEditar.transferencia}
          ecografiasExistentes={[]}
          ecografiaEditar={ecoEditar.eco}
          puedeCambiarResultado={ecoEditar.esUltima}
          onClose={() => setEcoEditar(null)}
          onSuccess={recargar}
        />
      )}

      {transfEditar && (
        <EditarTransferenciaModal
          transferencia={transfEditar}
          onClose={() => setTransfEditar(null)}
          onSuccess={recargar}
        />
      )}
    </div>
  )
}

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y.slice(2)}`
}
