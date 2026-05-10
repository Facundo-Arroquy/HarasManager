import { getSupabaseClient } from '../lib/supabase'
import { isMockMode } from '../dev/mockMode'
import { MOCK_CABALLOS } from '../dev/mockData'

export const caballoService = {
  async listar(sociedadId: string) {
    if (isMockMode()) {
      return MOCK_CABALLOS.filter((c) => c.sociedad_id === sociedadId && c.activo)
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('caballo')
      .select(`
        id, nombre, fecha_nacimiento, categoria,
        numero_chip, numero_registro, activo,
        cat_raza(nombre),
        cat_pelaje(nombre)
      `)
      .eq('sociedad_id', sociedadId)
      .eq('activo', true)
      .order('nombre')
    if (error) throw error
    return data
  },

  async obtener(id: string) {
    if (isMockMode()) {
      const caballo = MOCK_CABALLOS.find((c) => c.id === id)
      if (!caballo) throw new Error('Caballo no encontrado')
      return caballo
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('caballo')
      .select(`
        id, nombre, fecha_nacimiento, categoria,
        numero_chip, numero_registro, activo, sociedad_id,
        cat_raza(id, nombre),
        cat_pelaje(id, nombre)
      `)
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },
}
