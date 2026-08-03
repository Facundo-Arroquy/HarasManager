import { getSupabaseClient } from '../lib/supabase'

export interface Marca {
  id: string
  nombre: string
  dominio_email?: string | null
}

export const marcaService = {
  async listar(sociedadId: string): Promise<Marca[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('marca')
      .select('id, nombre, dominio_email')
      .eq('sociedad_id', sociedadId)
      .eq('activa', true)
      .order('nombre')
    if (error) throw error
    return (data ?? []) as Marca[]
  },
}
