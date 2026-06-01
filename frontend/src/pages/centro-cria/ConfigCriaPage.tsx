import { useState, useEffect } from 'react'
import { Settings2, RotateCcw, Check } from 'lucide-react'
import {
  getCriaConfig,
  saveCriaConfig,
  resetCriaConfig,
  CRIA_CONFIG_DEFAULTS,
  type CriaConfigData,
} from '../../utils/criaConfig'

export default function ConfigCriaPage() {
  const [config, setConfig] = useState<CriaConfigData>(getCriaConfig)
  const [guardado, setGuardado] = useState(false)

  function setField(key: keyof CriaConfigData, value: number) {
    setConfig((prev) => ({ ...prev, [key]: value }))
    setGuardado(false)
  }

  function handleGuardar() {
    saveCriaConfig(config)
    setGuardado(true)
  }

  function handleReset() {
    resetCriaConfig()
    setConfig(CRIA_CONFIG_DEFAULTS)
    setGuardado(false)
  }

  return (
    <div className="space-y-6 p-1 max-w-lg">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Configuración del centro</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Días de adelanto para recordatorios automáticos. Se guarda por dispositivo.
        </p>
      </div>

      {/* Donante */}
      <Section title="Donante" icon={<Settings2 size={14} />}>
        <Regla
          label="Strelin → Inseminación (IN)"
          valor={config.donante_strelin_a_in}
          default_={CRIA_CONFIG_DEFAULTS.donante_strelin_a_in}
          onChange={(v) => setField('donante_strelin_a_in', v)}
        />
        <Regla
          label="Inseminación (IN) → OXI"
          valor={config.donante_in_a_oxi}
          default_={CRIA_CONFIG_DEFAULTS.donante_in_a_oxi}
          onChange={(v) => setField('donante_in_a_oxi', v)}
        />
        <Regla
          label="Ovulación (OV) → Flushing"
          valor={config.donante_ov_a_flushing}
          default_={CRIA_CONFIG_DEFAULTS.donante_ov_a_flushing}
          onChange={(v) => setField('donante_ov_a_flushing', v)}
        />
        <Regla
          label="PG → Revisión PG"
          valor={config.donante_pg_a_revision_pg}
          default_={CRIA_CONFIG_DEFAULTS.donante_pg_a_revision_pg}
          onChange={(v) => setField('donante_pg_a_revision_pg', v)}
        />
        <Regla
          label="Flushing → Revisión Flushing"
          valor={config.donante_flushing_a_revision}
          default_={CRIA_CONFIG_DEFAULTS.donante_flushing_a_revision}
          onChange={(v) => setField('donante_flushing_a_revision', v)}
        />
      </Section>

      {/* Receptora */}
      <Section title="Receptora" icon={<Settings2 size={14} />}>
        <Regla
          label="PG → Revisión PG"
          valor={config.receptora_pg_a_revision_pg}
          default_={CRIA_CONFIG_DEFAULTS.receptora_pg_a_revision_pg}
          onChange={(v) => setField('receptora_pg_a_revision_pg', v)}
        />
        <Regla
          label="Ovulación (OV) → Dar PG"
          valor={config.receptora_ov_a_dar_pg}
          default_={CRIA_CONFIG_DEFAULTS.receptora_ov_a_dar_pg}
          onChange={(v) => setField('receptora_ov_a_dar_pg', v)}
        />
      </Section>

      {/* Nota reglas fijas */}
      <p className="text-xs text-slate-400">
        Las revisiones de Strelin (Receptora) y revisiones manuales se agenden al próximo lunes, miércoles o viernes — no son configurables.
      </p>

      {/* Acciones */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleGuardar}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-400 text-sm font-medium text-white transition-colors"
        >
          {guardado ? <Check size={14} /> : null}
          {guardado ? 'Guardado' : 'Guardar cambios'}
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <RotateCcw size={13} />
          Restablecer valores por defecto
        </button>
      </div>
    </div>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function Section({
  title, icon, children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wider">
        {icon}
        {title}
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </div>
  )
}

function Regla({
  label, valor, default_, onChange,
}: {
  label: string
  valor: number
  default_: number
  onChange: (v: number) => void
}) {
  const [raw, setRaw] = useState(String(valor))
  const modificado = valor !== default_

  // Sincronizar si el valor externo cambia (ej: reset)
  useEffect(() => {
    setRaw(String(valor))
  }, [valor])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRaw(e.target.value)
  }

  function handleBlur() {
    const v = parseInt(raw, 10)
    if (!isNaN(v) && v >= 1 && v <= 30) {
      onChange(v)
      setRaw(String(v))
    } else {
      // Revertir al valor válido actual
      setRaw(String(valor))
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className={`text-sm flex-1 ${modificado ? 'text-slate-700' : 'text-slate-500'}`}>
        {label}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        {modificado && (
          <span className="text-[10px] text-amber-600 border border-amber-300 rounded px-1.5 py-0.5">
            modificado
          </span>
        )}
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={1}
            max={30}
            value={raw}
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-14 rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-sm text-center text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <span className="text-xs text-slate-400">días</span>
        </div>
      </div>
    </div>
  )
}
