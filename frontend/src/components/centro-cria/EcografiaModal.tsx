import { useEffect, useState } from 'react'
import { X, AlertCircle, Activity } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useCrianzaStore } from '../../store/crianzaStore'
import { CHIPS_OI_OD, LABEL_RESULTADO_ECO } from '../../types/crianza'
import type {
  ResultadoEcografia, TransferenciaEmbrionaria, RecordatorioCria,
} from '../../types/crianza'
import ChipSelector from './ChipSelector'
import { hoyAR, formatFecha } from '../../utils/fecha'

interface Props {
  transferencia: TransferenciaEmbrionaria
  /** Ecografías ya cargadas para esta transferencia (para sugerir el número). */
  ecografiasExistentes: { numero: number }[]
  /**
   * Recordatorio 'Eco 1/2/3' que abrió el modal. Con él la eco queda enganchada
   * al recordatorio y el recordatorio queda `hecho` al guardar; sin él es una
   * eco suelta cargada desde Transferencias.
   */
  recordatorio?: RecordatorioCria
  onClose: () => void
  onSuccess?: () => void
}

const RESULTADOS: ResultadoEcografia[] = ['prenada', 'abortada', 'pendiente']

const RESULTADO_STYLE: Record<ResultadoEcografia, string> = {
  prenada:   'bg-emerald-100 text-emerald-700 border-emerald-300',
  abortada:  'bg-red-100 text-red-700 border-red-300',
  pendiente: 'bg-amber-100 text-amber-700 border-amber-300',
}

export default function EcografiaModal({
  transferencia, ecografiasExistentes, recordatorio, onClose, onSuccess,
}: Props) {
  const { user, sociedadActiva } = useAuth()
  const registrarEcografia = useCrianzaStore((s) => s.registrarEcografia)
  const actualizarEstadoRecordatorio = useCrianzaStore((s) => s.actualizarEstadoRecordatorio)

  // Sugerir el próximo número de eco según las ya registradas (habitualmente
  // son 3, pero puede haber más).
  const maxExistente = ecografiasExistentes.reduce((m, e) => Math.max(m, e.numero), 0)
  // Viniendo de un recordatorio 'Eco 2', el número lo dice el recordatorio: es
  // la que se agendó, aunque alguna anterior se haya salteado.
  const numeroDelRecordatorio = Number(recordatorio?.tipo.match(/^Eco (\d+)$/)?.[1])
  const proximoNumero = numeroDelRecordatorio || maxExistente + 1

  const [numero,     setNumero]     = useState<number>(proximoNumero)
  const [fecha,      setFecha]      = useState(hoyAR())
  const [resultado,  setResultado]  = useState<ResultadoEcografia>('pendiente')
  const [ovarioIzq,  setOvarioIzq]  = useState<string[]>([])
  const [ovarioDer,  setOvarioDer]  = useState<string[]>([])
  const [notas,      setNotas]      = useState('')

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  // El vet no tiene sociedadActiva: se deriva de la transferencia.
  const efectivaSociedadId = sociedadActiva?.id ?? transferencia.sociedad_id

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!fecha) return setError('La fecha es requerida.')
    if (!user?.id || !efectivaSociedadId) return

    setSaving(true)
    try {
      await registrarEcografia({
        sociedad_id:          efectivaSociedadId,
        transferencia_id:     transferencia.id,
        caballo_receptora_id: transferencia.caballo_receptora_id,
        veterinario_id:       user.id,
        numero,
        fecha,
        resultado,
        ovario_izq:           ovarioIzq,
        ovario_der:           ovarioDer,
        notas:                notas.trim() || null,
        origen_recordatorio_id: recordatorio?.id ?? null,
      })
      // La eco que pedía el recordatorio ya está cargada: si no se cierra, se
      // sigue ofreciendo y la próxima vez se carga de nuevo.
      if (recordatorio) await actualizarEstadoRecordatorio(recordatorio.id, 'hecho')
      onSuccess?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md sm:mx-4 rounded-t-2xl sm:rounded-xl border border-slate-300 bg-white shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-brand-600" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Registrar ecografía</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {transferencia.receptora?.nombre ?? 'Receptora'}
                {transferencia.donante?.nombre ? ` ← ${transferencia.donante.nombre}` : ''}
              </p>
              {recordatorio && (
                <p className="text-xs text-brand-600 mt-0.5">
                  {recordatorio.tipo} agendada para el {formatFecha(recordatorio.fecha_vto)} · al guardar queda hecha
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form
          id="ecografia-form"
          onSubmit={handleSubmit}
          className="overflow-y-auto flex-1 px-5 py-4 space-y-4"
        >
          {/* Número + Fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Ecografía N°</label>
              <input
                type="number"
                min={1}
                value={numero}
                onChange={(e) => setNumero(Math.max(1, Number(e.target.value) || 1))}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <p className="text-[10px] text-slate-400">Habitualmente 3; se pueden agregar más.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Fecha *</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Resultado */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Resultado *</label>
            <div className="flex gap-1.5">
              {RESULTADOS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setResultado(r)}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                    resultado === r
                      ? RESULTADO_STYLE[r]
                      : 'bg-slate-100 text-slate-500 border-slate-300 hover:border-slate-400'
                  }`}
                >
                  {LABEL_RESULTADO_ECO[r]}
                </button>
              ))}
            </div>
            {resultado === 'abortada' && (
              <p className="text-[11px] text-red-500">
                La yegua pasará a estado «Vacía» y volverá al circuito de revisión.
              </p>
            )}
            {resultado === 'prenada' && (
              <p className="text-[11px] text-emerald-600">
                La yegua pasará a estado «Preñada».
              </p>
            )}
          </div>

          {/* Ovarios */}
          <ChipSelector
            label="Ovario izquierdo"
            options={CHIPS_OI_OD}
            selected={ovarioIzq}
            onChange={setOvarioIzq}
          />
          <ChipSelector
            label="Ovario derecho"
            options={CHIPS_OI_OD}
            selected={ovarioDer}
            onChange={setOvarioDer}
          />

          {/* Notas */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Notas</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Observaciones adicionales…"
              className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600">
              <AlertCircle size={13} />
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="ecografia-form"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-md bg-brand-500 hover:bg-brand-400 text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar ecografía'}
          </button>
        </div>
      </div>
    </div>
  )
}
