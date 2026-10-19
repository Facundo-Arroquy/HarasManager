import { useState } from 'react'
import { useSaveHandler } from '../../hooks/useSaveHandler'
import { useCrianzaStore } from '../../store/crianzaStore'
import type { RecordatorioCria } from '../../types/crianza'
import { formatFecha, sumarDias, esFinDeSemana, esSabado } from '../../utils/fecha'
import ModalEdicion, { CampoFecha, CampoNotas } from './ModalEdicion'

interface Props {
  recordatorio: RecordatorioCria
  onClose:   () => void
  onSuccess: () => void
}

/**
 * Corrige la fecha y las notas de un recordatorio. El tipo no se edita: de él
 * depende qué modal abre al registrarlo (una 'Eco 2' busca su transferencia).
 *
 * Cuando la nueva fecha cae sábado o domingo, pregunta si mover al lunes.
 */
export default function EditarRecordatorioModal({ recordatorio: r, onClose, onSuccess }: Props) {
  const activo = r.estado === 'pendiente' || r.estado === 'vencido'
  const [fecha, setFecha] = useState(r.fecha_vto)
  const [notas, setNotas] = useState(r.notas ?? '')
  const [findeAviso, setFindeAviso] = useState(false)
  const { saving, error, setError, execute } = useSaveHandler('Error al guardar.')
  const { posponerRecordatorioAFecha } = useCrianzaStore()

  function guardar() {
    if (!fecha) return setError('La fecha es requerida.')
    // Si la fecha cambió y cae finde → avisar
    if (activo && fecha !== r.fecha_vto && esFinDeSemana(fecha) && !findeAviso) {
      setFindeAviso(true)
      return
    }
    ejecutarGuardado(fecha)
  }

  function usarLunes() {
    const esS = esSabado(fecha)
    const lunes = sumarDias(fecha, esS ? 2 : 1)
    setFecha(lunes)
    setFindeAviso(false)
    ejecutarGuardado(lunes)
  }

  function mantenerFinde() {
    setFindeAviso(false)
    ejecutarGuardado(fecha)
  }

  function ejecutarGuardado(fechaFinal: string) {
    execute(async () => {
      const cambioFecha = activo && fechaFinal !== r.fecha_vto
      if (cambioFecha) {
        await posponerRecordatorioAFecha(r.id, fechaFinal, 'edicion_manual')
      } else {
        // Solo notas — update directo sin historial de reprogramación
        const { crianzaService } = await import('../../services/crianzaService')
        await crianzaService.actualizarRecordatorio(r.id, {
          notas: notas.trim() || null,
        })
      }
      onSuccess()
      onClose()
    })
  }

  return (
    <>
      <ModalEdicion
        titulo={`Editar recordatorio · ${r.tipo}`}
        subtitulo={r.caballo?.nombre}
        onClose={onClose}
        onSubmit={guardar}
        saving={saving}
        error={error}
      >
        <CampoFecha
          label="Fecha"
          value={fecha}
          onChange={(v) => { setFecha(v); setFindeAviso(false) }}
          disabled={!activo}
          ayuda={!activo
            ? 'Ya está hecho o cancelado: la fecha queda como estaba.'
            : r.auto_generado
              ? 'Es automático: moverlo no cambia el registro que lo generó.'
              : undefined}
        />
        {activo && fecha !== r.fecha_vto && esFinDeSemana(fecha) && !findeAviso && (
          <p className="text-xs text-amber-600 -mt-1">
            Cae {esSabado(fecha) ? 'sábado' : 'domingo'} — al guardar se te ofrecerá moverlo.
          </p>
        )}
        <CampoNotas value={notas} onChange={setNotas} />
      </ModalEdicion>

      {/* Aviso de fin de semana */}
      {findeAviso && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" onClick={() => setFindeAviso(false)}>
          <div className="bg-white rounded-lg shadow-xl p-5 w-80 space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold text-slate-900">
              Cae {esSabado(fecha) ? 'sábado' : 'domingo'}
            </p>
            <p className="text-xs text-slate-600">
              La fecha elegida es <span className="font-medium">{formatFecha(fecha)}</span>.
              ¿Querés pasarlo al lunes?
            </p>
            <div className="flex flex-col gap-1.5 pt-1">
              <button
                onClick={usarLunes}
                className="w-full text-left px-3 py-2 text-xs rounded-md border border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100 font-medium"
              >
                Sí, pasar al lunes {formatFecha(sumarDias(fecha, esSabado(fecha) ? 2 : 1))}
              </button>
              <button
                onClick={mantenerFinde}
                className="w-full text-left px-3 py-2 text-xs rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                No, mantener {esSabado(fecha) ? 'sábado' : 'domingo'}
              </button>
              <button
                onClick={() => setFindeAviso(false)}
                className="w-full text-left px-3 py-2 text-xs rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Volver a elegir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
