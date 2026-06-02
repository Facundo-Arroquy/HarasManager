import { getSupabaseClient } from '../lib/supabase'
import { isMockMode } from '../dev/mockMode'

export type LeadEstado =
  | 'nuevo'
  | 'contactado'
  | 'demo_agendada'
  | 'demo_realizada'
  | 'convertido'
  | 'perdido'

export interface LeadInput {
  nombre: string
  email: string
  telefono: string
  nombre_establecimiento: string
  cantidad_animales: string
  modulos_interes: string[]
  mensaje: string
}

export interface LeadManualInput {
  nombre: string
  email: string
  telefono: string
  nombre_establecimiento: string
  cantidad_animales: string
  modulos_interes: string[]
  mensaje: string
  estado: LeadEstado
  responsable: string
  notas: string
}

export interface LeadCompleto {
  id: string
  nombre: string
  email: string
  telefono: string | null
  nombre_establecimiento: string
  cantidad_animales: string | null
  modulos_interes: string[] | null
  mensaje: string | null
  estado: LeadEstado
  responsable: string | null
  origen: 'landing' | 'manual'
  notas: string | null
  created_at: string
  updated_at: string | null
}

export async function insertarLead(data: LeadInput): Promise<void> {
  if (isMockMode()) return
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('lead')
    .insert([{ ...data, origen: 'landing', estado: 'nuevo' }])
  if (error) throw error
}

export async function crearLeadManual(data: LeadManualInput): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('lead')
    .insert([{ ...data, origen: 'manual' }])
  if (error) throw error
}

export async function actualizarLead(
  id: string,
  campos: Partial<Pick<LeadCompleto, 'estado' | 'responsable' | 'telefono' | 'notas'>>
): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('lead')
    .update({ ...campos, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
