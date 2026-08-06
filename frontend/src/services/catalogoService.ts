import { getSupabaseClient } from '../lib/supabase'

export const catalogoService = {
  async tiposConsulta() {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cat_tipo_consulta')
      .select('id, nombre')
      .order('nombre')
    if (error) throw error
    return data
  },

  async partesCuerpo() {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cat_parte_cuerpo')
      .select('id, nombre')
      .order('nombre')
    if (error) throw error
    return data
  },

  async razas() {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cat_raza')
      .select('id, nombre')
      .order('nombre')
    if (error) throw error
    return data
  },

  async pelajes() {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cat_pelaje')
      .select('id, nombre')
      .order('nombre')
    if (error) throw error
    return data
  },
}
