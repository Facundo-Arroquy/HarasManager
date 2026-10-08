import { X } from 'lucide-react'
import { useCrianzaStore } from '../../store/crianzaStore'
import { useSaveHandler } from '../../hooks/useSaveHandler'
import { useEscapeClose } from '../../hooks/useEscapeClose'
import { formatFecha as formatFechaAR } from '../../utils/fecha'
import type { RecordatorioCria } from '../../types/crianza'

interface Props {
  recordatorio: RecordatorioCria
  /** Reinseminar: el que abre esto sigue con el registro de la IN nueva. */
  onReinseminar: () => void
  onClose:   () => void
  onSuccess: () => void
}

/**
 * A las 48 h de la IN sin OV, reinseminar queda a criterio del vet. Si
 * reinsemina, carga la IN y arranca un circuito nuevo; si no, el circuito de
 * esa IN se cierra y Reinseminar no vuelve a aparecer solo por el paso del
 * tiempo.
 */
export default function ReinseminarModal({ recordatorio: r, onReinseminar, onClose, onSuccess }: Props) {
  const decidirNoReinseminar = useCrianzaStore((s) => s.decidirNoReinseminar)
  const { saving, error, execute } = useSaveHandler('No se pudo guardar la decisión.')
  useEscapeClose(onClose)

  function noReinseminar() {
    execute(async () => {
      await decidirNoReinseminar(r)
      onSuccess()
      onClose()
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md sm:mx-4 rounded-t-2xl sm:rounded-xl border border-slate-300 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">¿Reinseminar?</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {r.caballo?.nombre ?? 'Donante'} · agendado para el {formatFechaAR(r.fecha_vto)}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4 text-sm text-slate-600">
          <p>
            Pasaron 48 h desde la inseminación y todavía no se registró OV. El semen tiene una
            ventana aproximada de 48 h.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
            <li><b>Reinseminar:</b> cargás la IN nueva y el circuito vuelve a empezar (OXI, chequear ovulación).</li>
            <li><b>No reinseminar:</b> se cierra el seguimiento de esta inseminación. No se vuelve a pedir hasta una IN nueva.</li>
          </ul>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={noReinseminar}
            disabled={saving}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'No reinseminar'}
          </button>
          <button
            type="button"
            onClick={onReinseminar}
            disabled={saving}
            className="flex-1 rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-400 transition-colors disabled:opacity-50"
          >
            Reinseminar (cargar IN)
          </button>
        </div>
      </div>
    </div>
  )
}
