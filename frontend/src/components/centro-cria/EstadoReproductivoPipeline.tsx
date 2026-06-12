import { Check } from 'lucide-react'
import {
  PASOS_DONANTE,
  PASOS_RECEPTORA,
  LABEL_ESTADO,
  type EstadoReproductivo,
} from '../../types/crianza'

interface Props {
  rol:    'Donante' | 'Receptora'
  estado: EstadoReproductivo
}

export default function EstadoReproductivoPipeline({ rol, estado }: Props) {
  const pasos = rol === 'Donante' ? PASOS_DONANTE : PASOS_RECEPTORA

  // Estado 'vacia' no es parte del flujo lineal → mostrar badge aparte
  const estaVacia = estado === 'vacia'

  const idxActual = estado && !estaVacia
    ? pasos.indexOf(estado as any)
    : -1

  if (estaVacia) {
    return (
      <div className="px-4 pb-3 pt-0.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
          Vacía
        </span>
      </div>
    )
  }

  return (
    <div className="px-4 pb-3 pt-0.5 overflow-x-auto scrollbar-none">
      <ol className="flex items-center gap-0 min-w-max">
        {pasos.map((paso, idx) => {
          const esPasado  = idxActual > idx
          const esActual  = idxActual === idx
          const esFuturo  = idxActual < idx
          const esUltimo  = idx === pasos.length - 1

          return (
            <li key={paso} className="flex items-center">
              {/* Paso */}
              {esPasado && (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200">
                  <Check size={10} className="text-slate-500" strokeWidth={2.5} />
                </span>
              )}

              {esActual && (
                <span
                  className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
                    rol === 'Donante'
                      ? 'bg-purple-100 text-purple-700 ring-purple-200'
                      : 'bg-teal-100 text-teal-700 ring-teal-200'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      rol === 'Donante' ? 'bg-purple-500' : 'bg-teal-500'
                    }`}
                  />
                  {LABEL_ESTADO[paso]}
                </span>
              )}

              {esFuturo && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-200" />
              )}

              {/* Conector */}
              {!esUltimo && (
                <span
                  className={`mx-1 h-px w-3 shrink-0 ${
                    esPasado ? 'bg-slate-300' : 'bg-slate-200'
                  }`}
                />
              )}
            </li>
          )
        })}
      </ol>

      {/* Sin estado asignado */}
      {idxActual === -1 && !estaVacia && (
        <span className="text-[11px] text-slate-400">Sin estado</span>
      )}
    </div>
  )
}
