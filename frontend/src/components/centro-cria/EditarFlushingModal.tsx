import { useState } from 'react'
import { useSaveHandler } from '../../hooks/useSaveHandler'
import { crianzaService } from '../../services/crianzaService'
import type { Flushing } from '../../types/crianza'
import ModalEdicion, { CampoFecha, CampoNotas, CampoSelect } from './ModalEdicion'

interface Props {
  flushing:  Flushing
  onClose:   () => void
  onSuccess: () => void
}

/**
 * Corrige fecha, PG y notas de un flushing. Resultado, cantidad y padrillo no
 * se editan acá: salen de los embriones cargados, que se corrigen o eliminan
 * desde Embriones.
 */
export default function EditarFlushingModal({ flushing: f, onClose, onSuccess }: Props) {
  const [fecha,   setFecha]   = useState(f.fecha)
  const [pgGiven, setPgGiven] = useState<'si' | 'no'>(f.pg_given ? 'si' : 'no')
  const [notas,   setNotas]   = useState(f.notas ?? '')
  const { saving, error, setError, execute } = useSaveHandler('Error al guardar.')

  function guardar() {
    if (!fecha) return setError('La fecha es requerida.')
    execute(async () => {
      await crianzaService.actualizarFlushing(f.id, {
        fecha,
        pg_given: pgGiven === 'si',
        notas:    notas.trim() || null,
      })
      onSuccess()
      onClose()
    })
  }

  return (
    <ModalEdicion
      titulo="Editar flushing"
      subtitulo={f.es_negativo ? 'Negativo' : `${f.cantidad ?? 0} embri${f.cantidad === 1 ? 'ón' : 'ones'}`}
      onClose={onClose}
      onSubmit={guardar}
      saving={saving}
      error={error}
    >
      <CampoFecha label="Fecha" value={fecha} onChange={setFecha} />
      <CampoSelect
        label="PG"
        value={pgGiven}
        onChange={(v) => setPgGiven(v === 'si' ? 'si' : 'no')}
        opciones={[{ valor: 'si', etiqueta: 'Se dio' }, { valor: 'no', etiqueta: 'No' }]}
        vacio={null}
      />
      <CampoNotas value={notas} onChange={setNotas} />
    </ModalEdicion>
  )
}
