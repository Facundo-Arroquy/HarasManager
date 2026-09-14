import { useState } from 'react'
import { useSaveHandler } from '../../hooks/useSaveHandler'
import { crianzaService } from '../../services/crianzaService'
import type { RecordatorioCria } from '../../types/crianza'
import { hoyAR } from '../../utils/fecha'
import ModalEdicion, { CampoFecha, CampoNotas } from './ModalEdicion'

interface Props {
  recordatorio: RecordatorioCria
  onClose:   () => void
  onSuccess: () => void
}

/**
 * Corrige la fecha y las notas de un recordatorio. El tipo no se edita: de él
 * depende qué modal abre al registrarlo (una 'Eco 2' busca su transferencia).
 */
export default function EditarRecordatorioModal({ recordatorio: r, onClose, onSuccess }: Props) {
  const activo = r.estado === 'pendiente' || r.estado === 'vencido'
  const [fecha, setFecha] = useState(r.fecha_vto)
  const [notas, setNotas] = useState(r.notas ?? '')
  const { saving, error, setError, execute } = useSaveHandler('Error al guardar.')

  function guardar() {
    if (!fecha) return setError('La fecha es requerida.')
    execute(async () => {
      const cambioFecha = activo && fecha !== r.fecha_vto
      await crianzaService.actualizarRecordatorio(r.id, {
        notas: notas.trim() || null,
        // Moverlo a una fecha futura lo vuelve a dejar pendiente; a una pasada,
        // vencido — como lo marcaría la sincronización de vencidos.
        ...(cambioFecha ? { fecha_vto: fecha, estado: fecha >= hoyAR() ? 'pendiente' : 'vencido' } : {}),
      })
      onSuccess()
      onClose()
    })
  }

  return (
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
        onChange={setFecha}
        disabled={!activo}
        ayuda={!activo
          ? 'Ya está hecho o cancelado: la fecha queda como estaba.'
          : r.auto_generado
            ? 'Es automático: moverlo no cambia el registro que lo generó.'
            : undefined}
      />
      <CampoNotas value={notas} onChange={setNotas} />
    </ModalEdicion>
  )
}
