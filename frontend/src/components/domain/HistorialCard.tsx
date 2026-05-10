import { ChevronDown, ChevronUp, Pill, MapPin, Calendar } from 'lucide-react'
import { useState } from 'react'
import { formatFecha } from '../../utils/fecha'

interface Parte {
  id: string
  lado?: string | null
  descripcion?: string | null
  cat_parte_cuerpo: { nombre: string }
}

interface Medicamento {
  id: string
  medicamento: string
  dosis?: string | null
  via_administracion?: string | null
  duracion_dias?: number | null
}

interface HistorialEntry {
  id: string
  fecha_consulta: string
  diagnostico?: string | null
  tratamiento?: string | null
  observaciones?: string | null
  proxima_consulta?: string | null
  cat_tipo_consulta: { nombre: string }
  usuario: { nombre: string; apellido: string }
  historial_parte_afectada: Parte[]
  historial_medicamento: Medicamento[]
}

interface Props {
  entry: HistorialEntry
}

export default function HistorialCard({ entry }: Props) {
  const [open, setOpen] = useState(false)
  const tieneDetalle =
    entry.historial_parte_afectada.length > 0 ||
    entry.historial_medicamento.length > 0 ||
    !!entry.observaciones ||
    !!entry.proxima_consulta

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      {/* Header del registro */}
      <button
        className="w-full flex items-start gap-4 p-4 text-left hover:bg-zinc-800/50 transition-colors"
        onClick={() => tieneDetalle && setOpen((v) => !v)}
        aria-expanded={open}
      >
        {/* Fecha */}
        <div className="shrink-0 text-center min-w-[3rem]">
          <p className="text-xl font-bold text-zinc-100 leading-none">
            {new Date(entry.fecha_consulta).getDate()}
          </p>
          <p className="text-[10px] uppercase text-zinc-500 tracking-wide">
            {new Date(entry.fecha_consulta).toLocaleDateString('es-AR', { month: 'short' })}
          </p>
          <p className="text-[10px] text-zinc-600">
            {new Date(entry.fecha_consulta).getFullYear()}
          </p>
        </div>

        {/* Contenido principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] font-medium text-zinc-300 ring-1 ring-zinc-700">
              {entry.cat_tipo_consulta.nombre}
            </span>
            <span className="text-[11px] text-zinc-500">
              Dr/a. {entry.usuario.nombre} {entry.usuario.apellido}
            </span>
          </div>
          {entry.diagnostico && (
            <p className="text-sm text-zinc-300 line-clamp-2">{entry.diagnostico}</p>
          )}
          {entry.tratamiento && (
            <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{entry.tratamiento}</p>
          )}
        </div>

        {/* Indicadores + toggle */}
        <div className="shrink-0 flex items-center gap-2">
          {entry.historial_parte_afectada.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
              <MapPin size={11} />
              {entry.historial_parte_afectada.length}
            </span>
          )}
          {entry.historial_medicamento.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
              <Pill size={11} />
              {entry.historial_medicamento.length}
            </span>
          )}
          {tieneDetalle && (
            <span className="text-zinc-600">
              {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          )}
        </div>
      </button>

      {/* Detalle expandible */}
      {open && (
        <div className="border-t border-zinc-800 px-4 pb-4 pt-3 space-y-4">
          {/* Partes afectadas */}
          {entry.historial_parte_afectada.length > 0 && (
            <section>
              <h4 className="text-[11px] uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1.5">
                <MapPin size={11} /> Partes afectadas
              </h4>
              <ul className="space-y-1">
                {entry.historial_parte_afectada.map((p) => (
                  <li key={p.id} className="text-xs text-zinc-300">
                    <span className="font-medium">{p.cat_parte_cuerpo.nombre}</span>
                    {p.lado && p.lado !== 'no aplica' && (
                      <span className="text-zinc-500"> · {p.lado}</span>
                    )}
                    {p.descripcion && (
                      <span className="text-zinc-500"> — {p.descripcion}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Medicamentos */}
          {entry.historial_medicamento.length > 0 && (
            <section>
              <h4 className="text-[11px] uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1.5">
                <Pill size={11} /> Medicamentos
              </h4>
              <ul className="space-y-1.5">
                {entry.historial_medicamento.map((m) => (
                  <li key={m.id} className="text-xs">
                    <span className="font-medium text-zinc-300">{m.medicamento}</span>
                    <span className="text-zinc-500">
                      {m.dosis && ` · ${m.dosis}`}
                      {m.via_administracion && ` · ${m.via_administracion}`}
                      {m.duracion_dias && ` · ${m.duracion_dias} días`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Observaciones */}
          {entry.observaciones && (
            <section>
              <h4 className="text-[11px] uppercase tracking-widest text-zinc-500 mb-1">
                Observaciones
              </h4>
              <p className="text-xs text-zinc-400">{entry.observaciones}</p>
            </section>
          )}

          {/* Próxima consulta */}
          {entry.proxima_consulta && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Calendar size={12} />
              Próxima consulta: {formatFecha(entry.proxima_consulta)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
