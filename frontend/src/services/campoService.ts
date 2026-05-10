import { getSupabaseClient } from '../lib/supabase'
import { isMockMode } from '../dev/mockMode'
import { MOCK_CAMPOS, MOCK_CABALLOS } from '../dev/mockData'

export interface Campo {
  id: string
  nombre: string
  descripcion?: string | null
  sociedad_id: string
}

export const campoService = {
  async listar(sociedadId: string): Promise<Campo[]> {
    if (isMockMode()) {
      return MOCK_CAMPOS.filter((c) => c.sociedad_id === sociedadId)
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('campo')
      .select('id, nombre, descripcion, sociedad_id')
      .eq('sociedad_id', sociedadId)
      .order('nombre')
    if (error) throw error
    return data ?? []
  },

  async crear(nombre: string, descripcion: string | undefined, sociedadId: string): Promise<Campo> {
    if (isMockMode()) {
      const nuevo: Campo = {
        id: `camp-${Date.now()}`,
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        sociedad_id: sociedadId,
      }
      MOCK_CAMPOS.push(nuevo)
      return nuevo
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('campo')
      .insert({ nombre: nombre.trim(), descripcion: descripcion?.trim() || null, sociedad_id: sociedadId })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async asignarCaballo(caballoId: string, campoId: string | null): Promise<void> {
    if (isMockMode()) {
      const caballo = MOCK_CABALLOS.find((c) => c.id === caballoId)
      if (!caballo) return
      caballo.campo_id = campoId
      const campo = campoId ? MOCK_CAMPOS.find((c) => c.id === campoId) : null
      caballo.campo = campo ? { nombre: campo.nombre } : null
      return
    }

    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('caballo')
      .update({ campo_id: campoId })
      .eq('id', caballoId)
    if (error) throw error
  },
}
