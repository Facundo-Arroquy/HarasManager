import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Link2Off, X } from 'lucide-react'
import type { Caballo } from '../../services/caballoService'

export interface HorseRef {
  id?: string | null
  nombre?: string | null
}

interface Props {
  label: string
  placeholder: string
  value: HorseRef
  onChange: (val: HorseRef) => void
  caballos: Caballo[]
}

export default function PedigreeCombobox({ label, placeholder, value, onChange, caballos }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  // Derive display label
  let displayLabel = ''
  if (value.id) {
    const found = caballos.find((c) => c.id === value.id)
    displayLabel = found ? found.nombre : value.id
  } else if (value.nombre) {
    displayLabel = value.nombre
  }

  const filtered = query.trim()
    ? caballos.filter((c) => c.nombre.toLowerCase().includes(query.toLowerCase()))
    : caballos

  function selectHorse(c: Caballo) {
    onChange({ id: c.id, nombre: null })
    setOpen(false)
  }

  function useFreeName() {
    const name = query.trim()
    if (!name) return
    onChange({ id: null, nombre: name })
    setOpen(false)
  }

  function clear() {
    onChange({ id: null, nombre: null })
    setOpen(false)
  }

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <label className="text-xs font-medium text-zinc-400">{label}</label>

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between rounded-md border px-3 py-2 text-sm text-left transition-colors
          ${open ? 'border-emerald-500 bg-zinc-800' : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'}
          ${!displayLabel ? 'text-zinc-600' : value.id ? 'text-zinc-200' : 'text-zinc-400'}`}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          {displayLabel ? (
            <>
              {!value.id && <Link2Off size={11} className="text-zinc-500 shrink-0" />}
              <span className="truncate">{displayLabel}</span>
            </>
          ) : (
            <span>{placeholder}</span>
          )}
        </span>
        <ChevronDown size={13} className={`text-zinc-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="relative z-50">
          <div className="absolute top-0 left-0 right-0 rounded-md border border-zinc-700 bg-zinc-900 shadow-xl">
            {/* Search input */}
            <div className="p-2 border-b border-zinc-800">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (filtered.length === 1) selectHorse(filtered[0])
                    else if (query.trim()) useFreeName()
                  }
                  if (e.key === 'Escape') setOpen(false)
                }}
                placeholder="Buscar caballo…"
                className="w-full bg-transparent text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none"
              />
            </div>

            {/* Options list */}
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0 && !query.trim() ? (
                <p className="px-3 py-2 text-xs text-zinc-600">Sin caballos registrados</p>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={() => selectHorse(c)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-zinc-800 transition-colors text-left
                      ${value.id === c.id ? 'text-emerald-400' : 'text-zinc-300'}`}
                  >
                    <span>{c.nombre}</span>
                    <span className="text-xs text-zinc-600">{c.categoria}</span>
                  </button>
                ))
              )}
            </div>

            {/* Footer actions */}
            <div className="border-t border-zinc-800">
              {query.trim() && (
                <button
                  type="button"
                  onMouseDown={useFreeName}
                  className="w-full flex items-center gap-1.5 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors text-left"
                >
                  <Link2Off size={12} className="text-zinc-500 shrink-0" />
                  <span>Usar nombre: <span className="text-zinc-200">"{query.trim()}"</span></span>
                </button>
              )}
              {(value.id || value.nombre) && (
                <button
                  type="button"
                  onMouseDown={clear}
                  className="w-full flex items-center gap-1.5 px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors text-left"
                >
                  <X size={12} className="shrink-0" />
                  <span>Limpiar</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
