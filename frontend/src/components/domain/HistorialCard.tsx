import { ChevronDown, ChevronUp, Pill, MapPin, Calendar, Pencil } from 'lucide-react'
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

export interface HistorialEntry {
  id: string
  fecha_consulta: string
  diagnostico?: string | null
  tratamiento?: string | null
  observaciones?: string | null
  proxima_consulta?: string | null
  creado_por?: string | null
  cat_tipo_consulta: { id?: number; nombre: string }
  usuario: { nombre: string; apellido: string }
  historial_parte_afectada: Parte[]
  historial_medicamento: Medicamento[]
}

interface Props {
  entry: HistorialEntry
  onEditar?: () => void
}

export default function HistorialCard({ entry, onEditar }: Props) {
  const [open, setOpen] = useState(false)
  const tieneDetalle =
    entry.historial_parte_afectada.length > 0 ||
    entry.historial_medicamento.length > 0 ||
    !!entry.observaciones ||
    !!entry.proxima_consulta

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header: área clickeable para expandir + acciones separadas */}
      <div className="flex items-start gap-4 p-4 hover:bg-slate-50 transition-colors">
        {/* Zona de click para expandir */}
        <div
          className="flex-1 flex items-start gap-4 cursor-pointer min-w-0"
          onClick={() => tieneDetalle && setOpen((v) => !v)}
        >
          {/* Fecha */}
          <div className="shrink-0 text-center min-w-[3rem]">
            <p className="text-xl font-bold text-slate-900 leading-none">
              {new Date(entry.fecha_consulta).getDate()}
            </p>
            <p className="text-[10px] uppercase text-slate-400 tracking-wide">
              {new Date(entry.fecha_consulta).toLocaleDateString('es-AR', {
                month: 'short',
                timeZone: 'America/Argentina/Buenos_Aires',
              })}
            </p>
            <p className="text-[10px] text-slate-400">
              {new Date(entry.fecha_consulta).toLocaleDateString('es-AR', {
                year: 'numeric',
                timeZone: 'America/Argentina/Buenos_Aires',
              })}
            </p>
          </div>

          {/* Contenido */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                {entry.cat_tipo_consulta.nombre}
              </span>
              <span className="text-[11px] text-slate-400">
                Dr/a. {entry.usuario.nombre} {entry.usuario.apellido}
              </span>
            </div>
            {entry.diagnostico && (
              <p className="text-sm text-slate-600 line-clamp-2">{entry.diagnostico}</p>
            )}
            {entry.tratamiento && (
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{entry.tratamiento}</p>
            )}
          </div>
        </div>

        {/* Acciones: indicadores + editar + toggle */}
        <div className="shrink-0 flex items-center gap-2 mt-0.5">
          {entry.historial_parte_afectada.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <MapPin size={11} />
              {entry.historial_parte_afectada.length}
            </span>
          )}
          {entry.historial_medicamento.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <Pill size={11} />
              {entry.historial_medicamento.length}
            </span>
          )}
          {onEditar && (
            <button
              onClick={onEditar}
              className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              title="Editar consulta"
            >
              <Pencil size={13} />
            </button>
          )}
          {tieneDetalle && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="text-slate-400 hover:text-slate-500 transition-colors"
              aria-expanded={open}
            >
              {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Detalle expandible */}
      {open && (
        <div className="border-t border-slate-200 px-4 pb-4 pt-3 space-y-4">
          {entry.historial_parte_afectada.length > 0 && (
            <section>
              <h4 className="text-[11px] uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                <MapPin size={11} /> Partes afectadas
              </h4>
              <ul className="space-y-1">
                {entry.historial_parte_afectada.map((p) => (
                  <li key={p.id} className="text-xs text-slate-600">
                    <span className="font-medium">{p.cat_parte_cuerpo.nombre}</span>
                    {p.lado && p.lado !== 'no aplica' && (
                      <span className="text-slate-400"> · {p.lado}</span>
                    )}
                    {p.descripcion && (
                      <span className="text-slate-400"> — {p.descripcion}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {entry.historial_medicamento.length > 0 && (
            <section>
              <h4 className="text-[11px] uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                <Pill size={11} /> Medicamentos
              </h4>
              <ul className="space-y-1.5">
                {entry.historial_medicamento.map((m) => (
                  <li key={m.id} className="text-xs">
                    <span className="font-medium text-slate-600">{m.medicamento}</span>
                    <span className="text-slate-400">
                      {m.dosis && ` · ${m.dosis}`}
                      {m.via_administracion && ` · ${m.via_administracion}`}
                      {m.duracion_dias && ` · ${m.duracion_dias} días`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {entry.observaciones && (
            <section>
              <h4 className="text-[11px] uppercase tracking-widest text-slate-400 mb-1">
                Observaciones
              </h4>
              <p className="text-xs text-slate-500">{entry.observaciones}</p>
            </section>
          )}

          {entry.proxima_consulta && (
            <div className="flex items-center gap-1.5 text-xs text-brand-600">
              <Calendar size={12} />
              Próxima consulta: {formatFecha(entry.proxima_consulta)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
