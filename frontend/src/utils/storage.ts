import { getSupabaseClient } from '../lib/supabase'

/** Duración de las signed URLs en segundos (1 hora). */
const SIGNED_URL_TTL = 3600

/**
 * Dado un valor de `imagen_url` (que puede ser una URL pública legacy o un
 * path relativo al bucket), devuelve una signed URL válida para mostrar la
 * imagen. Devuelve cadena vacía si no se puede generar.
 *
 * URLs legacy tienen la forma:
 *   https://<project>.supabase.co/storage/v1/object/public/caballos/consultas/...
 * Paths nuevos son simplemente:
 *   consultas/<caballoId>/<timestamp>.<ext>
 */
export async function resolveImagenConsultaUrl(
  imagenUrl: string | null | undefined,
): Promise<string> {
  if (!imagenUrl) return ''

  // Extraer el path relativo al bucket si es una URL completa legacy
  let path = imagenUrl
  const publicPrefix = '/storage/v1/object/public/caballos/'
  const idx = imagenUrl.indexOf(publicPrefix)
  if (idx !== -1) {
    path = imagenUrl.slice(idx + publicPrefix.length)
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase.storage
    .from('caballos')
    .createSignedUrl(path, SIGNED_URL_TTL)

  if (error || !data?.signedUrl) return ''
  return data.signedUrl
}
