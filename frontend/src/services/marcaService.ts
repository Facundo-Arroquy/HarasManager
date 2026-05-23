import { getSupabaseClient } from '../lib/supabase'
import { isMockMode } from '../dev/mockMode'
import { MOCK_MARCAS } from '../dev/mockData'

export interface Marca {
  id: string
  nombre: string
  dominio_email?: string | null
}

export const marcaService = {
  async listar(sociedadId: string): Promise<Marca[]> {
    if (isMockMode()) {
      return MOCK_MARCAS.filter((m: { sociedad_id: string; activa: boolean }) => m.sociedad_id === sociedadId && m.activa) as Marca[]
    }
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
