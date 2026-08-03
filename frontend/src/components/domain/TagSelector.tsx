import { useEffect, useState } from 'react'
import { Tag as TagIcon, Check } from 'lucide-react'
import { tagService, type Tag } from '../../services/tagService'

interface Props {
  /** Ids de tags seleccionados. */
  value: number[]
  onChange: (ids: number[]) => void
  /** Se oculta cuando la categoría del animal no admite tags. */
  disabled?: boolean
}

/**
 * Selector de tags del caballo (hoy solo "Jugador"). El catálogo se lee de
 * `cat_tag`, así que sumar un tag nuevo no requiere tocar este componente.
 */
export default function TagSelector({ value, onChange, disabled = false }: Props) {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    tagService.listar()
      .then(setTags)
      .catch(() => setTags([]))
      .finally(() => setLoading(false))
  }, [])

  function toggle(id: number) {
    onChange(value.includes(id) ? value.filter((t) => t !== id) : [...value, id])
  }

  if (loading || tags.length === 0) return null

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <TagIcon size={12} className="text-slate-400" />
        Tags
      </label>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const activo = value.includes(tag.id)
          return (
            <button
              key={tag.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(tag.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                ${activo
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-slate-300 bg-slate-50 text-slate-500 hover:border-slate-400'}`}
            >
              {activo && <Check size={11} />}
              {tag.nombre}
            </button>
          )
        })}
      </div>
      {disabled && (
        <p className="text-[11px] text-slate-400">
          Los tags se asignan a caballos y yeguas.
        </p>
      )}
    </div>
  )
}
