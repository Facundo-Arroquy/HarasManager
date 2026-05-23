import { getSupabaseClient } from '../lib/supabase'
import { isMockMode } from '../dev/mockMode'

const BUCKET = 'caballos'
const MOCK_KEY = (id: string) => `hm_foto_caballo_${id}`

export const fotoService = {
  /** URL pública de la foto. En mock devuelve el data URL guardado en localStorage. */
  getUrl(caballoId: string): string {
    if (isMockMode()) {
      return localStorage.getItem(MOCK_KEY(caballoId)) ?? ''
    }
    const base = import.meta.env.VITE_SUPABASE_URL
    if (!base) return ''
    return `${base}/storage/v1/object/public/${BUCKET}/${caballoId}`
  },

  /** Sube (o reemplaza) la foto del caballo. Devuelve la URL resultante. */
  async subir(caballoId: string, file: File): Promise<string> {
    if (isMockMode()) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string
          localStorage.setItem(MOCK_KEY(caballoId), dataUrl)
          resolve(dataUrl)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    }

    const supabase = getSupabaseClient()
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(caballoId, file, { upsert: true, contentType: file.type })

    if (error) throw new Error(error.message)
    return this.getUrl(caballoId)
  },

  /** Elimina la foto del caballo. */
  async eliminar(caballoId: string): Promise<void> {
    if (isMockMode()) {
      localStorage.removeItem(MOCK_KEY(caballoId))
      return
    }
    const supabase = getSupabaseClient()
    await supabase.storage.from(BUCKET).remove([caballoId])
  },
}
