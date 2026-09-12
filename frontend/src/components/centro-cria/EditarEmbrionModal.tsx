import { useState } from 'react'
import { useSaveHandler } from '../../hooks/useSaveHandler'
import { crianzaService } from '../../services/crianzaService'
import {
  ESTADIOS_EMBRION, TAMANIOS_EMBRION, GRADOS_EMBRION, ZONAS_EMBRION,
} from '../../types/crianza'
import type { Embrion, EstadoEmbrion } from '../../types/crianza'
import { opcionesDe } from '../../utils/opciones'
import ModalEdicion, { CampoNotas, CampoSelect } from './ModalEdicion'

interface Props {
  embrion:   Embrion
  onClose:   () => void
  onSuccess: () => void
}

type Grado = NonNullable<Embrion['grado']>

/** Estados que se eligen a mano. 'transferido' solo lo pone una transferencia. */
const ESTADOS_EDITABLES: { valor: EstadoEmbrion; etiqueta: string }[] = [
  { valor: 'disponible', etiqueta: 'Disponible' },
  { valor: 'congelado',  etiqueta: 'Vitrificado' },
  { valor: 'en_nube',    etiqueta: 'En nube' },
  { valor: 'descartado', etiqueta: 'Descartado' },
]

export default function EditarEmbrionModal({ embrion: e, onClose, onSuccess }: Props) {
  const transferido = e.estado === 'transferido'
  const [estado,  setEstado]  = useState<EstadoEmbrion>(e.estado)
  const [estadio, setEstadio] = useState<string>(e.estadio ?? '')
  const [tamanio, setTamanio] = useState<string>(e.tamanio ?? '')
  const [grado,   setGrado]   = useState<Grado | ''>(e.grado ?? '')
  const [zona,    setZona]    = useState<string>(e.zona_pelucida ?? '')
  const [notas,   setNotas]   = useState(e.notas ?? '')
  const { saving, error, execute } = useSaveHandler('Error al guardar.')

  function guardar() {
    execute(async () => {
      await crianzaService.actualizarEmbrion(e.id, {
        estado,
        estadio:       estadio || null,
        tamanio:       tamanio || null,
        grado:         grado === '' ? null : grado,
        zona_pelucida: zona || null,
        notas:         notas.trim() || null,
      })
      onSuccess()
      onClose()
    })
  }

  return (
    <ModalEdicion
      titulo="Editar embrión"
      subtitulo={e.donante?.nombre ? `Donante: ${e.donante.nombre}` : null}
      onClose={onClose}
      onSubmit={guardar}
      saving={saving}
      error={error}
    >
      {transferido ? (
        <p className="text-[11px] text-slate-400">
          Ya se transfirió: el estado no se cambia acá. Para devolverlo al stock, eliminá la transferencia.
        </p>
      ) : (
        <CampoSelect
          label="Estado"
          value={estado}
          onChange={(v) => { if (v) setEstado(v) }}
          opciones={ESTADOS_EDITABLES}
          vacio={null}
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        <CampoSelect label="Estadio" value={estadio} onChange={setEstadio} opciones={opcionesDe(ESTADIOS_EMBRION)} />
        <CampoSelect label="Tamaño"  value={tamanio} onChange={setTamanio} opciones={opcionesDe(TAMANIOS_EMBRION)} />
        <CampoSelect label="Grado"   value={grado}   onChange={setGrado}   opciones={opcionesDe<Grado>(GRADOS_EMBRION)} />
        <CampoSelect label="Zona pelúcida" value={zona} onChange={setZona} opciones={opcionesDe(ZONAS_EMBRION)} />
      </div>
      <CampoNotas value={notas} onChange={setNotas} />
    </ModalEdicion>
  )
}
