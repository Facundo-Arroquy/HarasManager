import type { ReactNode } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { useEscapeClose } from '../../hooks/useEscapeClose'

const INPUT = 'w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50'

interface Props {
  titulo:    string
  subtitulo?: string | null
  onClose:   () => void
  onSubmit:  () => void
  saving:    boolean
  error:     string | null
  children:  ReactNode
}

/** Estructura común de los modales que corrigen un registro del Centro de Cría. */
export default function ModalEdicion({ titulo, subtitulo, onClose, onSubmit, saving, error, children }: Props) {
  useEscapeClose(onClose)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md sm:mx-4 rounded-t-2xl sm:rounded-xl border border-slate-300 bg-white shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{titulo}</h2>
            {subtitulo && <p className="text-xs text-slate-500 mt-0.5">{subtitulo}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); onSubmit() }}
          className="flex flex-col min-h-0 flex-1"
        >
          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
            {children}
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-600">
                <AlertCircle size={13} />
                {error}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-md bg-brand-500 hover:bg-brand-400 text-white transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function CampoSelect<T extends string | number>({
  label, value, onChange, opciones, vacio = '— Sin dato —', disabled = false,
}: {
  label:    string
  value:    T | ''
  onChange: (v: T | '') => void
  opciones: ReadonlyArray<{ valor: T; etiqueta: string }>
  /** Etiqueta de la opción vacía; `null` para no ofrecerla. */
  vacio?:   string | null
  disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <select
        value={String(value)}
        disabled={disabled}
        onChange={(e) => {
          const elegida = opciones.find((o) => String(o.valor) === e.target.value)
          onChange(elegida ? elegida.valor : '')
        }}
        className={INPUT}
      >
        {vacio !== null && <option value="">{vacio}</option>}
        {opciones.map((o) => (
          <option key={String(o.valor)} value={String(o.valor)}>{o.etiqueta}</option>
        ))}
      </select>
    </div>
  )
}

export function CampoFecha({
  label, value, onChange, disabled = false, ayuda,
}: {
  label:    string
  value:    string
  onChange: (v: string) => void
  disabled?: boolean
  ayuda?:   string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <input
        type="date"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT}
      />
      {ayuda && <p className="text-[11px] text-slate-400">{ayuda}</p>}
    </div>
  )
}

export function CampoNotas({
  label = 'Notas', value, onChange,
}: {
  label?:   string
  value:    string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder="Observaciones adicionales…"
        className={`${INPUT} resize-none`}
      />
    </div>
  )
}
