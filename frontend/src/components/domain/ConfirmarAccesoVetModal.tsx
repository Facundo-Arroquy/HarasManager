import { ShieldAlert } from 'lucide-react'
import type { CaballoSinAcceso } from '../../types/sanidad'

interface Props {
  vetNombre: string
  caballos:  CaballoSinAcceso[]
  /** Texto del botón de confirmación: cambia entre crear y compartir. */
  textoConfirmar?: string
  saving?:   boolean
  onConfirmar: () => void
  onCancelar:  () => void
}

/**
 * Se muestra cuando el veterinario elegido no tiene acceso a alguno de los
 * caballos del plan. El acceso que se otorga no es "a este plan": es al caballo
 * entero y de forma permanente, así que el cartel lo dice explícito en vez de
 * limitarse a avisar que falta el permiso.
 */
export default function ConfirmarAccesoVetModal({
  vetNombre, caballos, textoConfirmar = 'Otorgar acceso y crear el plan',
  saving = false, onConfirmar, onCancelar,
}: Props) {
  const n = caballos.length

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onCancelar() }}
    >
      <div className="w-full max-w-md sm:mx-4 rounded-t-2xl sm:rounded-xl border border-slate-300 bg-white shadow-2xl">
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-500" />
            <h2 className="text-sm font-semibold text-slate-900">
              {vetNombre} no tiene acceso a {n} de los caballos seleccionados
            </h2>
          </div>

          <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <ul className="space-y-0.5 text-xs text-slate-600">
              {caballos.map((c) => <li key={c.caballo_id}>{c.nombre}</li>)}
            </ul>
          </div>

          <p className="text-xs leading-relaxed text-slate-500">
            Para compartirle el plan hay que darle acceso a {n === 1 ? 'ese caballo' : 'esos caballos'}.
            El acceso incluye el <strong className="font-medium text-slate-700">historial clínico completo</strong>{' '}
            y queda activo hasta que lo revoques desde <em>Accesos veterinarios</em>.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onCancelar}
            disabled={saving}
            className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-md bg-brand-500 hover:bg-brand-400 text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando…' : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  )
}
