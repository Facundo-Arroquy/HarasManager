import { getSupabaseClient } from '../lib/supabase'
import { isMockMode } from '../dev/mockMode'
import { MOCK_TIPOS_CONSULTA, MOCK_RAZAS, MOCK_PELAJES } from '../dev/mockData'

// Partes del cuerpo — lista completa para el selector del modal
const MOCK_PARTES = [
  { id: 1,  nombre: 'Cabeza' },
  { id: 2,  nombre: 'Cuello' },
  { id: 3,  nombre: 'Lomo' },
  { id: 4,  nombre: 'Grupa' },
  { id: 5,  nombre: 'Pecho' },
  { id: 6,  nombre: 'Abdomen' },
  { id: 7,  nombre: 'Hombro derecho' },
  { id: 8,  nombre: 'Hombro izquierdo' },
  { id: 9,  nombre: 'Rodilla delantera derecha' },
  { id: 10, nombre: 'Rodilla delantera izquierda' },
  { id: 11, nombre: 'Caña delantera derecha' },
  { id: 12, nombre: 'Caña delantera izquierda' },
  { id: 13, nombre: 'Menudillo delantero derecho' },
  { id: 14, nombre: 'Menudillo delantero izquierdo' },
  { id: 15, nombre: 'Casco delantero derecho' },
  { id: 16, nombre: 'Casco delantero izquierdo' },
  { id: 17, nombre: 'Corvejón derecho' },
  { id: 18, nombre: 'Corvejón izquierdo' },
  { id: 19, nombre: 'Caña trasera derecha' },
  { id: 20, nombre: 'Caña trasera izquierda' },
  { id: 21, nombre: 'Menudillo trasero derecho' },
  { id: 22, nombre: 'Menudillo trasero izquierdo' },
  { id: 23, nombre: 'Casco trasero derecho' },
  { id: 24, nombre: 'Casco trasero izquierdo' },
]

export const catalogoService = {
  async tiposConsulta() {
    if (isMockMode()) return MOCK_TIPOS_CONSULTA
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cat_tipo_consulta')
      .select('id, nombre')
      .order('nombre')
    if (error) throw error
    return data
  },

  async partesCuerpo() {
    if (isMockMode()) return MOCK_PARTES
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cat_parte_cuerpo')
      .select('id, nombre')
      .order('nombre')
    if (error) throw error
    return data
  },

  async razas() {
    if (isMockMode()) return MOCK_RAZAS
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cat_raza')
      .select('id, nombre')
      .order('nombre')
    if (error) throw error
    return data
  },

  async pelajes() {
    if (isMockMode()) return MOCK_PELAJES
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cat_pelaje')
      .select('id, nombre')
      .order('nombre')
    if (error) throw error
    return data
  },
}
