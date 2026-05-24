import { isMockMode, getMockUserId } from '../dev/mockMode'
import { MOCK_CABALLOS, MOCK_SOCIEDADES, MOCK_TRANSFERENCIAS_EMPRESA } from '../dev/mockData'
import { getSupabaseClient } from '../lib/supabase'

export interface SociedadItem {
  id: string
  nombre: string
}

export interface TransferenciaEmpresa {
  id: string
  caballoIds: string[]
  caballoNombres: string[]
  tipo: 'registrada' | 'no_registrada'
  sociedadDestinoId?: string
  sociedadDestinoNombre?: string
  entidadNombre?: string
  sociedadOrigenId: string
  fecha: string
  creadoPor: string
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
    if (isMockMode()) {
      return MOCK_SOCIEDADES.filter((s) => s.id !== excludeId)
    }
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

  async transferir(payload: TransferirPayload, sociedadOrigenId: string): Promise<void> {
    if (isMockMode()) {
      const caballoNombres: string[] = []

      for (const id of payload.caballoIds) {
        const caballo = MOCK_CABALLOS.find((c) => c.id === id)
        if (!caballo) continue
        caballoNombres.push(caballo.nombre)

        if (payload.tipo === 'registrada' && payload.sociedadDestinoId) {
          caballo.sociedad_id = payload.sociedadDestinoId
        } else {
          caballo.activo = false
        }
      }

      const registro: TransferenciaEmpresa = {
        id: `te-${Date.now()}`,
        caballoIds: payload.caballoIds,
        caballoNombres,
        tipo: payload.tipo,
        sociedadDestinoId: payload.sociedadDestinoId,
        sociedadDestinoNombre: payload.sociedadDestinoNombre,
        entidadNombre: payload.entidadNombre,
        sociedadOrigenId,
        fecha: new Date().toISOString(),
        creadoPor: getMockUserId(),
      }
      MOCK_TRANSFERENCIAS_EMPRESA.push(registro)
      return
    }

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

  async listarHistorial(sociedadOrigenId: string): Promise<TransferenciaEmpresa[]> {
    if (isMockMode()) {
      return [...MOCK_TRANSFERENCIAS_EMPRESA]
        .filter((t) => t.sociedadOrigenId === sociedadOrigenId)
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
    }
    return []
  },
}
