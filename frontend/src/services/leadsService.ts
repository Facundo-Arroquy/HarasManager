import { getSupabaseClient } from '../lib/supabase'
import { isMockMode } from '../dev/mockMode'

export interface LeadInput {
  nombre: string
  email: string
  nombre_establecimiento: string
  cantidad_animales: string
  modulos_interes: string[]
  mensaje: string
}

export async function insertarLead(data: LeadInput): Promise<void> {
  if (isMockMode()) return // En dev simulamos éxito sin tocar la DB
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('lead').insert([data])
  if (error) throw error
}
