import { useState } from 'react'
import { useSaveHandler } from '../../hooks/useSaveHandler'
import { crianzaService } from '../../services/crianzaService'
import { CL_CALIDADES, TONOS } from '../../types/crianza'
import type { TransferenciaEmbrionaria } from '../../types/crianza'
import { formatFecha } from '../../utils/fecha'
import { opcionesDe } from '../../utils/opciones'
import ModalEdicion, { CampoNotas, CampoSelect } from './ModalEdicion'

interface Props {
  transferencia: TransferenciaEmbrionaria
  onClose:   () => void
  onSuccess: () => void
}

type Clasificacion = NonNullable<TransferenciaEmbrionaria['clasificacion']>

/**
 * Corrige los datos descriptivos de una transferencia. Receptora, embrión y
 * fecha no se editan: de ellos cuelgan la preñez y los recordatorios de eco.
 * Para cambiarlos se elimina la transferencia y se vuelve a cargar.
 */
export default function EditarTransferenciaModal({ transferencia: t, onClose, onSuccess }: Props) {
  const [clCalidad,     setClCalidad]     = useState<string>(t.cl_calidad ?? '')
  const [tonoUterino,   setTonoUterino]   = useState<string>(t.tono_uterino ?? '')
  const [tonoCervical,  setTonoCervical]  = useState<string>(t.tono_cervical ?? '')
  const [clasificacion, setClasificacion] = useState<Clasificacion | ''>(t.clasificacion ?? '')
  const [notas,         setNotas]         = useState(t.notas ?? '')
  const { saving, error, execute } = useSaveHandler('Error al guardar.')

  function guardar() {
    execute(async () => {
      await crianzaService.actualizarTransferencia(t.id, {
        cl_calidad:    clCalidad || null,
        tono_uterino:  tonoUterino || null,
        tono_cervical: tonoCervical || null,
        clasificacion: clasificacion || null,
        notas:         notas.trim() || null,
      })
      onSuccess()
      onClose()
    })
  }

  return (
    <ModalEdicion
      titulo="Editar transferencia"
      subtitulo={`${t.receptora?.nombre ?? 'Receptora'} ← ${t.donante?.nombre ?? 'Donante'} · ${formatFecha(t.fecha)}`}
      onClose={onClose}
      onSubmit={guardar}
      saving={saving}
      error={error}
    >
      <p className="text-[11px] text-slate-400">
        Receptora, embrión y fecha no se pueden cambiar: si están mal, eliminá la transferencia y cargala de nuevo.
      </p>
      <CampoSelect
        label="Clasificación"
        value={clasificacion}
        onChange={setClasificacion}
        opciones={opcionesDe<Clasificacion>(['Fresco', 'Congelado'])}
      />
      <CampoSelect label="Calidad del CL" value={clCalidad} onChange={setClCalidad} opciones={opcionesDe(CL_CALIDADES)} />
      <div className="grid grid-cols-2 gap-3">
        <CampoSelect label="Tono uterino"  value={tonoUterino}  onChange={setTonoUterino}  opciones={opcionesDe(TONOS)} />
        <CampoSelect label="Tono cervical" value={tonoCervical} onChange={setTonoCervical} opciones={opcionesDe(TONOS)} />
      </div>
      <CampoNotas value={notas} onChange={setNotas} />
    </ModalEdicion>
  )
}
