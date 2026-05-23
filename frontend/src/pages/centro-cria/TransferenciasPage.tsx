import { useEffect } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useCrianzaStore } from '../../store/crianzaStore'
import Spinner from '../../components/ui/Spinner'

export default function TransferenciasPage() {
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const { transferencias, loading, cargar } = useCrianzaStore()

  useEffect(() => {
    if (sociedadId && transferencias.length === 0) cargar(sociedadId)
  }, [sociedadId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="space-y-5 p-1">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Transferencias</h1>
        <p className="text-sm text-zinc-400 mt-0.5">Historial de transferencias embrionarias</p>
      </div>

      {transferencias.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 text-sm">
          <ArrowLeftRight size={28} className="mx-auto mb-2 opacity-30" />
          Sin transferencias registradas.
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden divide-y divide-zinc-800">
          {transferencias.map((t) => (
            <div key={t.id} className="px-4 py-3 text-sm">
              <div className="flex items-start gap-2 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-zinc-100">{t.receptora?.nombre ?? '—'}</span>
                    <span className="text-zinc-600">←</span>
                    <span className="text-zinc-300">{t.donante?.nombre ?? '—'}</span>
                    {t.padrillo && (
                      <>
                        <span className="text-zinc-600">×</span>
                        <span className="text-zinc-400">{t.padrillo.nombre}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-zinc-500">
                    {t.clasificacion && (
                      <span className="border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-400">
                        {t.clasificacion}
                      </span>
                    )}
                    {t.cl_calidad && <span>CL {t.cl_calidad}</span>}
                    {t.tono_uterino && <span>Útero {t.tono_uterino}</span>}
                    {t.veterinario && (
                      <span>Dr/a. {t.veterinario.apellido}</span>
                    )}
                  </div>
                  {t.notas && <p className="text-xs text-zinc-500 mt-1">{t.notas}</p>}
                </div>
                <span className="text-xs text-zinc-500 shrink-0">{formatFecha(t.fecha)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y.slice(2)}`
}
