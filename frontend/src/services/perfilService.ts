import { getSupabaseClient } from '../lib/supabase'

export interface Perfil {
  id: string
  nombre: string
  apellido: string
  email: string
  telefono: string | null
  rol: string | null
  /** NULL en los usuarios registrados antes de que el DNI fuera obligatorio. */
  dni: string | null
  matricula: string | null
}

export const perfilService = {
  /** Perfil del usuario logueado. La RLS ya limita el SELECT a `id = auth.uid()`. */
  async obtenerMio(usuarioId: string): Promise<Perfil> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('usuario')
      .select('id, nombre, apellido, email, telefono, rol, dni, matricula')
      .eq('id', usuarioId)
      .single()
    if (error) throw error
    return data as Perfil
  },
}
