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
  colorSelected = 'bg-emerald-800 text-emerald-200 border-emerald-700',
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
      <label className="text-xs font-medium text-zinc-400">{label}</label>
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
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-200'
              }`}
            >
              {opt}
            </button>
          )
        })}
      </div>
      {selected.length > 0 && (
        <p className="text-[10px] text-zinc-600">
          {selected.join(' · ')}
        </p>
      )}
    </div>
  )
}
