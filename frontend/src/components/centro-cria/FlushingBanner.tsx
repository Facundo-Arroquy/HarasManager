import { useState } from 'react'
import { Droplets, Clock3 } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useCrianzaStore } from '../../store/crianzaStore'
import type { RecordatorioCria } from '../../types/crianza'
import { hoyAR, formatFecha, sumarDias, diffDias } from '../../utils/fecha'
import { mensajeError } from '../../utils/error'
import NombreCaballoLink from '../domain/NombreCaballoLink'
import FlushingModal from './FlushingModal'

/**
 * Aviso de los flushings que tocan hoy.
 *
 * Muestra únicamente los recordatorios de tipo Flushing que vencen **el día
 * configurado** por el veterinario (`donante_ov_a_flushing`, que se aplica al
 * generar el recordatorio). No lista atrasados: si el flushing no se hace hoy,
 * el camino es posponerlo explícitamente y aparece mañana (día X+1).
 */
export default function FlushingBanner() {
  const rol = useAuthStore((s) => s.rol)
  const { recordatorios, registros, plazos, posponerRecordatorio } = useCrianzaStore()

  const [modalRec,    setModalRec]    = useState<RecordatorioCria | null>(null)
  const [posponiendo, setPosponiendo] = useState<string | null>(null)
  const [error,       setError]       = useState('')

  const hoy = hoyAR()
  const deHoy = recordatorios.filter(
    (r) => r.tipo === 'Flushing' && r.estado === 'pendiente' && r.fecha_vto === hoy
  )

  if (deHoy.length === 0) return null

  const puedeRegistrar = rol === 'veterinario'

  /**
   * Fecha de ovulación y día del ciclo.
   *
   * El día no se toma del plazo del usuario logueado: el recordatorio se generó
   * con el plazo del vet que cargó la OV, que puede ser otro. Sale del registro
   * de origen cuando existe, y recién si no está se cae al plazo propio.
   */
  function ciclo(r: RecordatorioCria): { fechaOv: string; dia: number } {
    const origen = registros.find((reg) => reg.id === r.origen_registro_id)
    if (origen) {
      const fechaOv = sumarDias(origen.fecha, -(origen.ov_dias ?? 0))
      return { fechaOv, dia: diffDias(fechaOv, r.fecha_vto) }
    }
    const dia = plazos.donante_ov_a_flushing
    return { fechaOv: sumarDias(r.fecha_vto, -dia), dia }
  }

  async function posponer(id: string) {
    setPosponiendo(id)
    setError('')
    try {
      await posponerRecordatorio(id, 1)
    } catch (err) {
      setError(mensajeError(err, 'No se pudo posponer el flushing.'))
    } finally {
      setPosponiendo(null)
    }
  }

  return (
    <>
      <div className="rounded-lg border border-brand-200 border-l-[3px] border-l-brand-500 bg-white overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 pt-3 pb-2.5">
          <Droplets size={16} className="text-brand-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Flushings para hacer</p>
            <p className="text-xs text-slate-500">
              Vencen hoy, al día configurado desde la ovulación
            </p>
          </div>
          <span className="ml-auto text-[11px] font-medium rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-brand-700">
            {deHoy.length}
          </span>
        </div>

        {deHoy.map((r) => {
          const { fechaOv, dia } = ciclo(r)
          return (
          <div
            key={r.id}
            className="flex items-center gap-3 flex-wrap border-t border-slate-100 px-4 py-2.5"
          >
            <NombreCaballoLink
              id={r.caballo_id}
              nombre={r.caballo?.nombre}
              className="text-sm font-medium text-slate-900"
            />
            <span className="text-[11px] font-medium rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-brand-700 tabular-nums">
              Día {dia} · hoy
            </span>
            <span className="text-xs text-slate-400 tabular-nums">
              OV {formatFecha(fechaOv)}
            </span>

            {puedeRegistrar && (
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => posponer(r.id)}
                  disabled={posponiendo === r.id}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-slate-300 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  title="Pasa el recordatorio a mañana"
                >
                  <Clock3 size={13} />
                  {posponiendo === r.id ? 'Posponiendo…' : 'Posponer a mañana'}
                </button>
                <button
                  onClick={() => setModalRec(r)}
                  className="text-xs font-medium px-3 py-1.5 rounded-md bg-brand-500 hover:bg-brand-400 text-white transition-colors"
                >
                  Registrar flushing
                </button>
              </div>
            )}
          </div>
          )
        })}

        {error && (
          <p className="border-t border-slate-100 px-4 py-2 text-xs text-red-600">{error}</p>
        )}
      </div>

      {modalRec && (
        <FlushingModal
          recordatorio={modalRec}
          onClose={() => setModalRec(null)}
          onSuccess={() => setModalRec(null)}
        />
      )}
    </>
  )
}
