import { useEffect } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useCrianzaStore } from '../../store/crianzaStore'
import Spinner from '../../components/ui/Spinner'

export default function TransferenciasPage() {
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const rol        = useAuthStore((s) => s.rol)
  const { transferencias, loading, cargar, cargarParaVet } = useCrianzaStore()

  useEffect(() => {
    if (sociedadId && transferencias.length === 0) cargar(sociedadId)
    else if (!sociedadId && rol === 'veterinario' && transferencias.length === 0) cargarParaVet()
  }, [sociedadId, rol]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="space-y-5 p-1">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Transferencias de embriones</h1>
        <p className="text-sm text-slate-500 mt-0.5">Historial de transferencias embrionarias</p>
      </div>

      {transferencias.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          <ArrowLeftRight size={28} className="mx-auto mb-2 opacity-30" />
          Sin transferencias registradas.
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden divide-y divide-slate-200">
          {transferencias.map((t) => (
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
                </div>
                <span className="text-xs text-slate-400 shrink-0">{formatFecha(t.fecha)}</span>
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
