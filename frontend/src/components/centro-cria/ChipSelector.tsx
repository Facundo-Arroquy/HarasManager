import { useState } from 'react'

interface Props {
  label: string
  options: readonly string[]
  selected: string[]
  onChange: (next: string[]) => void
  max?: number          // límite de selección (ej: ovarios = 1 OV)
  colorSelected?: string
  /**
   * Habilita escribir valores que no están en `options` — para los ovarios, donde
   * el vet necesita anotar cantidad y tamaño de folículo ("2 35" = dos de 35mm) y
   * un chip por tamaño no alcanza. La columna es TEXT[] sin constraint.
   */
  allowCustom?: boolean
  customPlaceholder?: string
}

export default function ChipSelector({
  label,
  options,
  selected,
  onChange,
  colorSelected = 'bg-brand-200 text-emerald-200 border-emerald-700',
  allowCustom = false,
  customPlaceholder = 'ej: 2 35',
}: Props) {
  const [borrador, setBorrador] = useState('')

  function toggle(opt: string) {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt))
    } else {
      onChange([...selected, opt])
    }
  }

  // Lo que el vet escribió a mano: va al final, después de los chips fijos.
  const personalizados = selected.filter((s) => !options.includes(s))

  function agregar() {
    const valor = borrador.trim().replace(/\s+/g, ' ')
    if (!valor) return
    if (!selected.includes(valor)) onChange([...selected, valor])
    setBorrador('')
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = selected.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors select-none ${
                active
                  ? colorSelected
                  : 'bg-slate-100 text-slate-500 border-slate-300 hover:border-slate-400 hover:text-slate-700'
              }`}
            >
              {opt}
            </button>
          )
        })}
        {personalizados.map((valor) => (
          <button
            key={valor}
            type="button"
            onClick={() => toggle(valor)}
            title="Quitar"
            className={`px-2.5 py-1 rounded-full text-xs border transition-colors select-none ${colorSelected}`}
          >
            {valor} <span aria-hidden="true">×</span>
          </button>
        ))}
      </div>

      {allowCustom && (
        <div className="flex gap-1.5">
          <input
            type="text"
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            // Enter agrega el valor sin enviar el formulario del modal.
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                agregar()
              }
            }}
            placeholder={customPlaceholder}
            className="w-24 rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="button"
            onClick={agregar}
            disabled={!borrador.trim()}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:border-slate-400 hover:text-slate-800 disabled:opacity-40 disabled:hover:border-slate-300"
          >
            Agregar
          </button>
        </div>
      )}

      {selected.length > 0 && (
        <p className="text-[10px] text-slate-400">
          {selected.join(' · ')}
        </p>
      )}
    </div>
  )
}
