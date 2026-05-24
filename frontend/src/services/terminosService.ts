import { getSupabaseClient } from '../lib/supabase'

export interface TerminosVigentes {
  id: string
  version: number
  titulo: string
  contenido: string
}

/** Devuelve los términos activos o null si no hay ninguno. */
export async function getTerminosVigentes(): Promise<TerminosVigentes | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('terminos_condiciones')
    .select('id, version, titulo, contenido')
    .eq('activo', true)
    .single()

  if (error || !data) return null
  return data as TerminosVigentes
}

/** Verifica si el usuario ya aceptó la versión vigente. */
export async function usuarioAceptoTerminos(
  usuarioId: string,
  versionId: string
): Promise<boolean> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('terminos_aceptacion')
    .select('id')
    .eq('usuario_id', usuarioId)
    .eq('version_id', versionId)
    .maybeSingle()

  if (error) return false
  return !!data
}

/** Registra la aceptación del usuario para una versión de términos. */
export async function aceptarTerminos(
  usuarioId: string,
  versionId: string
): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('terminos_aceptacion')
    .insert({ usuario_id: usuarioId, version_id: versionId })

  if (error) throw new Error(error.message)
}
