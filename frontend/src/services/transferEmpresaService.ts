import { getSupabaseClient } from '../lib/supabase'

export interface SociedadItem {
  id: string
  nombre: string
}

export interface TransferirPayload {
  caballoIds: string[]
  tipo: 'registrada' | 'no_registrada'
  sociedadDestinoId?: string
  sociedadDestinoNombre?: string
  entidadNombre?: string
}

export const transferEmpresaService = {
  async listarSociedades(excludeId: string): Promise<SociedadItem[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('sociedad')
      .select('id, nombre')
      .neq('id', excludeId)
      .order('nombre')
    if (error) throw error
    return data as SociedadItem[]
  },

  /** Para veterinarios: lista todas las sociedades activas (sin exclusión) */
  async listarTodasSociedades(): Promise<SociedadItem[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('get_sociedades_activas')
    if (error) throw error
    return (data ?? []) as SociedadItem[]
  },

  async transferir(payload: TransferirPayload): Promise<void> {
    const supabase = getSupabaseClient()
    if (payload.tipo === 'registrada' && payload.sociedadDestinoId) {
      const { error } = await supabase
        .from('caballo')
        .update({ sociedad_id: payload.sociedadDestinoId })
        .in('id', payload.caballoIds)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('caballo')
        .update({ activo: false })
        .in('id', payload.caballoIds)
      if (error) throw error
    }
  },

  /** Para veterinarios: transfiere caballos propios (vet_owner_id) a una organización */
  async transferirVet(caballoIds: string[], sociedadDestinoId: string): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase.rpc('transferir_caballos_vet', {
      p_caballo_ids: caballoIds,
      p_sociedad_destino_id: sociedadDestinoId,
    })
    if (error) throw error
  },
}
