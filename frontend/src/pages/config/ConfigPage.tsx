import CamposConfig from './CamposConfig'

export default function ConfigPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-slate-200 px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Configuración</h1>
        <p className="text-xs text-slate-400 mt-0.5">Campos, caballerizas y opciones del establecimiento</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <section>
          <h2 className="text-sm font-semibold text-slate-600 mb-4">Campos y Caballerizas</h2>
          <CamposConfig />
        </section>
      </div>
    </div>
  )
}
