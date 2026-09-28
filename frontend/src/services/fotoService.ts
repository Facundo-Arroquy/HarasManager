import { getSupabaseClient } from '../lib/supabase'

const BUCKET = 'caballos'
const VERSION_KEY = (id: string) => `hm_foto_v_${id}`
/** Duración de las signed URLs en segundos (1 hora). */
const SIGNED_URL_TTL = 3600

export const fotoService = {
  /**
   * Genera una signed URL para la foto del caballo.
   * Devuelve cadena vacía si nunca se subió una foto (no hay versión en
   * localStorage) o si la generación falla.
   */
  async getUrl(caballoId: string): Promise<string> {
    const v = localStorage.getItem(VERSION_KEY(caballoId))
    if (!v) return ''

    const supabase = getSupabaseClient()
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(caballoId, SIGNED_URL_TTL)

    if (error || !data?.signedUrl) return ''
    return data.signedUrl
  },

  /** Sube (o reemplaza) la foto del caballo. Devuelve la signed URL resultante. */
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
