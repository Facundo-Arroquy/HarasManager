import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { fotoService } from '../../services/fotoService'

interface Props {
  caballoId: string
  nombre: string
  canEdit?: boolean
  /** Diámetro en píxeles (default 72) */
  size?: number
}

export default function FotoCaballo({ caballoId, nombre, canEdit = false, size = 72 }: Props) {
  const [src, setSrc] = useState(() => fotoService.getUrl(caballoId))
  const [hasError, setHasError] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const showImg = Boolean(src) && !hasError

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await fotoService.subir(caballoId, file)
      // cache buster para URLs de Supabase (los data: URLs no lo necesitan)
      setSrc(url.startsWith('data:') ? url : `${url}?v=${Date.now()}`)
      setHasError(false)
    } catch {
      // fallo silencioso — el usuario puede reintentar
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const iconSize = Math.round(size * 0.25)

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      {/* Círculo avatar */}
      <div
        className={`w-full h-full rounded-full overflow-hidden border-2 flex items-center justify-center select-none ${
          showImg ? 'border-zinc-700' : 'border-zinc-800 bg-zinc-900'
        }`}
      >
        {showImg ? (
          <img
            src={src}
            alt={nombre}
            className="w-full h-full object-cover"
            onError={() => setHasError(true)}
          />
        ) : (
          // Inicial del nombre como placeholder
          <span
            className="font-bold text-zinc-600"
            style={{ fontSize: Math.round(size * 0.38) }}
          >
            {nombre.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {/* Overlay de edición */}
      {canEdit && (
        <>
          <button
            type="button"
            onClick={() => !uploading && inputRef.current?.click()}
            disabled={uploading}
            className={`absolute inset-0 rounded-full flex items-center justify-center transition-opacity ${
              uploading
                ? 'opacity-100 bg-black/50 cursor-wait'
                : 'opacity-0 hover:opacity-100 bg-black/50 cursor-pointer'
            }`}
            title="Cambiar foto"
          >
            {uploading ? (
              <div
                className="border-2 border-white/30 border-t-white rounded-full animate-spin"
                style={{ width: iconSize, height: iconSize }}
              />
            ) : (
              <Camera size={iconSize} className="text-white drop-shadow" />
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleChange}
          />
        </>
      )}
    </div>
  )
}
