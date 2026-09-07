import { getSupabaseClient } from '../lib/supabase'

/**
 * Caché en memoria por tabla de catálogo. Se guarda la Promise la primera vez
 * que se pide: así incluso llamadas simultáneas reutilizan el mismo request.
 * Los catálogos casi nunca cambian dentro de una sesión.
 */
const cache = new Map<string, Promise<unknown>>()

function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit) return hit as Promise<T>
  const p = fetcher()
  cache.set(key, p)
  // Si falla, limpiar para que el siguiente intento reintente
  p.catch(() => cache.delete(key))
  return p
}

export const catalogoService = {
  async tiposConsulta() {
    return cached('cat_tipo_consulta', async () => {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('cat_tipo_consulta')
        .select('id, nombre')
        .order('nombre')
      if (error) throw error
      return data
    })
  },

  async partesCuerpo() {
    return cached('cat_parte_cuerpo', async () => {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('cat_parte_cuerpo')
        .select('id, nombre')
        .order('nombre')
      if (error) throw error
      return data
    })
  },

  async razas() {
    return cached('cat_raza', async () => {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('cat_raza')
        .select('id, nombre')
        .order('nombre')
      if (error) throw error
      return data
    })
  },

  async pelajes() {
    return cached('cat_pelaje', async () => {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('cat_pelaje')
        .select('id, nombre')
        .order('nombre')
      if (error) throw error
      return data
    })
  },
}
