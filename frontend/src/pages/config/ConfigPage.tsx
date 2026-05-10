import CamposConfig from './CamposConfig'

export default function ConfigPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-zinc-800 px-6 py-4">
        <h1 className="text-lg font-semibold text-zinc-100">Configuración</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Campos, caballerizas y opciones del establecimiento</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <section>
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Campos y Caballerizas</h2>
          <CamposConfig />
        </section>
      </div>
    </div>
  )
}
