import CamposConfig from './CamposConfig'

/**
 * Campos propios del veterinario independiente. Equivalente a la sección de
 * campos de una sociedad, pero sobre los caballos que el vet maneja por su
 * cuenta (los que no pertenecen a ningún establecimiento).
 */
export default function CamposVetPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-slate-200 px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Mis campos</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Agrupá tus caballos por campo, caballeriza o establecimiento
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <CamposConfig modoVet />
      </div>
    </div>
  )
}
