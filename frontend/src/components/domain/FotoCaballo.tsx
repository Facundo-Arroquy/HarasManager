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
  const [src, setSrc]             = useState(() => fotoService.getUrl(caballoId))
  const [hasError, setHasError]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const showImg = Boolean(src) && !hasError

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await fotoService.subir(caballoId, file)
      setSrc(url.startsWith('data:') ? url : `${url}?v=${Date.now()}`)
      setHasError(false)
    } catch {
      // fallo silencioso
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  // Badge de cámara: tamaño fijo para que no sea gigante en tamaños grandes
  const badgeSize = Math.min(28, Math.max(18, Math.round(size * 0.3)))

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* ── Avatar ── */}
      <div
        className={`w-full h-full rounded-full overflow-hidden border-2 flex items-center justify-center select-none ${
          showImg ? 'border-slate-300' : 'border-slate-200 bg-white'
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
          <span
            className="font-bold text-slate-400"
            style={{ fontSize: Math.round(size * 0.38) }}
          >
            {nombre.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {/* ── Badge de cámara (solo canEdit) ── */}
      {canEdit && (
        <>
          <button
            type="button"
            onClick={() => !uploading && inputRef.current?.click()}
            disabled={uploading}
            title="Cambiar foto"
            className="absolute bottom-0 right-0 flex items-center justify-center rounded-full bg-slate-200 border-2 border-white hover:bg-amber-500 transition-colors cursor-pointer"
            style={{ width: badgeSize, height: badgeSize }}
          >
            {uploading ? (
              <div
                className="border-2 border-white/30 border-t-white rounded-full animate-spin"
                style={{ width: badgeSize * 0.45, height: badgeSize * 0.45 }}
              />
            ) : (
              <Camera size={badgeSize * 0.5} className="text-white" />
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
