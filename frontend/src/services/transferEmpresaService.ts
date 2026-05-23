import { isMockMode, getMockUserId } from '../dev/mockMode'
import { MOCK_CABALLOS, MOCK_SOCIEDADES, MOCK_TRANSFERENCIAS_EMPRESA } from '../dev/mockData'

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
    // TODO: Supabase
    // const supabase = getSupabaseClient()
    // const { data, error } = await supabase.from('sociedad').select('id, nombre').neq('id', excludeId)
    // if (error) throw error
    // return data
    return []
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

    // TODO: Supabase
    // const supabase = getSupabaseClient()
    // if (payload.tipo === 'registrada') {
    //   await supabase.from('caballo').update({ sociedad_id: payload.sociedadDestinoId }).in('id', payload.caballoIds)
    // } else {
    //   await supabase.from('caballo').update({ activo: false }).in('id', payload.caballoIds)
    // }
    // await supabase.from('transferencia_empresa').insert({ ... })
  },

  async listarHistorial(sociedadOrigenId: string): Promise<TransferenciaEmpresa[]> {
    if (isMockMode()) {
      return [...MOCK_TRANSFERENCIAS_EMPRESA]
        .filter((t) => t.sociedadOrigenId === sociedadOrigenId)
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
    }
    // TODO: Supabase
    return []
  },
}
