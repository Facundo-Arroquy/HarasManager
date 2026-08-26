import { useMemo } from 'react'
import { useCrianzaStore } from '../../store/crianzaStore'
import { receptorasOvuladas } from '../../utils/receptoras'
import { formatFecha } from '../../utils/fecha'

export interface ReceptoraBasica {
  id:     string
  nombre: string
}

interface Props {
  /** Fecha de la transferencia: contra ella se cuentan los días desde la ovulación. */
  fecha:    string
  /** `caballo_id` de la receptora elegida. */
  value:    string
  onChange: (caballoId: string) => void
  /**
   * Receptoras de la sociedad. Las que no tengan una ovulación registrada se
   * ofrecen igual, en un grupo aparte al final: el embrión vitrificado se puede
   * transferir meses después, cuando el registro de la OV quedó fuera de lo que
   * hay cargado.
   */
  todas?:   ReceptoraBasica[]
  /** Ids ya tomados por otro embrión del mismo flushing. */
  excluir?: string[]
}

/**
 * Lista de receptoras ordenada por días desde su ovulación (+1, +2, +3).
 *
 * Es el mismo selector para los dos caminos que terminan en una transferencia:
 * el flushing del día y la transferencia suelta de un embrión vitrificado o en
 * nube. La forma de elegir la receptora no debería depender de por dónde entraste.
 */
export default function SelectorReceptoras({ fecha, value, onChange, todas = [], excluir = [] }: Props) {
  const { registros, transferencias } = useCrianzaStore()

  // `excluir` llega como array nuevo en cada render; la clave lo vuelve estable.
  const excluirKey = excluir.join(',')

  const ovuladas = useMemo(() => {
    const fuera = new Set(excluirKey ? excluirKey.split(',') : [])
    return receptorasOvuladas(registros, transferencias, fecha)
      .filter((r) => !fuera.has(r.caballoId))
  }, [registros, transferencias, fecha, excluirKey])

  const sinOvulacion = useMemo(() => {
    const fuera = new Set(excluirKey ? excluirKey.split(',') : [])
    const conOv = new Set(ovuladas.map((r) => r.caballoId))
    return todas.filter((r) => !conOv.has(r.id) && !fuera.has(r.id))
  }, [todas, ovuladas, excluirKey])

  if (ovuladas.length === 0 && sinOvulacion.length === 0) {
    return (
      <p className="text-xs text-slate-400 py-2">
        No hay receptoras para elegir. Cargá la ovulación desde el registro reproductivo y volvé.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {ovuladas.length > 0 ? (
        <p className="text-[11px] font-medium text-slate-500">
          Receptoras ovuladas{' '}
          <span className="text-slate-400 font-normal">— ordenadas por días desde su ovulación</span>
        </p>
      ) : (
        <p className="text-[11px] text-amber-600">
          Ninguna receptora tiene una ovulación registrada a esta fecha.
        </p>
      )}

      {ovuladas.map((r) => (
        <Fila
          key={r.caballoId}
          nombre={r.nombre}
          detalle={`OV ${formatFecha(r.fechaOv)}${r.yaTransferida ? ' · ya transferida' : ''}`}
          badge={`+${r.diasDesdeOv}`}
          atenuada={r.yaTransferida}
          seleccionada={value === r.caballoId}
          onClick={() => onChange(r.caballoId)}
        />
      ))}

      {sinOvulacion.length > 0 && (
        <>
          <p className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-300 pt-1">
            Sin ovulación registrada
            <span className="flex-1 h-px bg-slate-200" />
          </p>
          {sinOvulacion.map((r) => (
            <Fila
              key={r.id}
              nombre={r.nombre}
              detalle="Sin OV cargada"
              atenuada
              seleccionada={value === r.id}
              onClick={() => onChange(r.id)}
            />
          ))}
        </>
      )}
    </div>
  )
}

function Fila({
  nombre, detalle, badge, atenuada, seleccionada, onClick,
}: {
  nombre:       string
  detalle:      string
  badge?:       string
  atenuada?:    boolean
  seleccionada: boolean
  onClick:      () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 flex-wrap rounded-md border px-2.5 py-2 text-left transition-colors ${
        seleccionada ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'
      } ${atenuada && !seleccionada ? 'opacity-60' : ''}`}
    >
      <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${
        seleccionada ? 'border-4 border-brand-500' : 'border-[1.5px] border-slate-300'
      }`} />
      <span className="text-sm font-medium text-slate-900">{nombre}</span>
      <span className="text-[11px] text-slate-400 tabular-nums">{detalle}</span>
      {badge && (
        <span className={`ml-auto text-[11px] font-medium rounded-full px-2 py-0.5 tabular-nums ${
          atenuada
            ? 'bg-slate-100 text-slate-400 border border-slate-200'
            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {badge}
        </span>
      )}
    </button>
  )
}
