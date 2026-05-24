interface Props {
  label: string
  options: readonly string[]
  selected: string[]
  onChange: (next: string[]) => void
  max?: number          // límite de selección (ej: ovarios = 1 OV)
  colorSelected?: string
}

export default function ChipSelector({
  label,
  options,
  selected,
  onChange,
  colorSelected = 'bg-amber-200 text-emerald-200 border-emerald-700',
}: Props) {
  function toggle(opt: string) {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt))
    } else {
      onChange([...selected, opt])
    }
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
      </div>
      {selected.length > 0 && (
        <p className="text-[10px] text-slate-400">
          {selected.join(' · ')}
        </p>
      )}
    </div>
  )
}
