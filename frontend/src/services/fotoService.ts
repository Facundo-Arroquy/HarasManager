import { getSupabaseClient } from '../lib/supabase'

const BUCKET = 'caballos'
const VERSION_KEY = (id: string) => `hm_foto_v_${id}`

export const fotoService = {
  /** URL pública de la foto. */
  getUrl(caballoId: string): string {
    const base = import.meta.env.VITE_SUPABASE_URL
    if (!base) return ''
    const url = `${base}/storage/v1/object/public/${BUCKET}/${caballoId}`
    const v = localStorage.getItem(VERSION_KEY(caballoId))
    return v ? `${url}?v=${v}` : url
  },

  /** Sube (o reemplaza) la foto del caballo. Devuelve la URL resultante. */
  async subir(caballoId: string, file: File): Promise<string> {
    const supabase = getSupabaseClient()
    // Intentar borrar si ya existe para evitar conflictos de UPDATE en RLS
    await supabase.storage.from(BUCKET).remove([caballoId])
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(caballoId, file, { contentType: file.type })

    if (error) throw new Error(error.message)
    localStorage.setItem(VERSION_KEY(caballoId), Date.now().toString())
    return this.getUrl(caballoId)
  },

  /** Elimina la foto del caballo. */
  async eliminar(caballoId: string): Promise<void> {
    const supabase = getSupabaseClient()
    await supabase.storage.from(BUCKET).remove([caballoId])
    localStorage.removeItem(VERSION_KEY(caballoId))
  },
}
