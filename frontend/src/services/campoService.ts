import { getSupabaseClient } from '../lib/supabase'
import { isMockMode } from '../dev/mockMode'
import { MOCK_CAMPOS, MOCK_CABALLOS } from '../dev/mockData'

export interface CampoConConteo extends Campo {
  caballos_count: number
}

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
      MOCK_CAMPOS.push(nuevo as any)
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

  async listarConConteo(sociedadId: string): Promise<CampoConConteo[]> {
    if (isMockMode()) {
      return MOCK_CAMPOS.filter((c) => c.sociedad_id === sociedadId).map((c) => ({
        ...c,
        caballos_count: MOCK_CABALLOS.filter((cab) => cab.campo_id === c.id && cab.activo).length,
      }))
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('campo')
      .select('id, nombre, descripcion, sociedad_id')
      .eq('sociedad_id', sociedadId)
      .order('nombre')
    if (error) throw error

    const campos = await Promise.all(
      (data ?? []).map(async (c: any) => {
        const { count } = await supabase
          .from('caballo')
          .select('*', { count: 'exact', head: true })
          .eq('campo_id', c.id)
          .eq('activo', true)
        return { ...c, caballos_count: count ?? 0 }
      })
    )
    return campos
  },

  async actualizar(id: string, nombre: string, descripcion: string | undefined): Promise<void> {
    if (isMockMode()) {
      const campo = MOCK_CAMPOS.find((c) => c.id === id)
      if (campo) {
        campo.nombre = nombre.trim()
        campo.descripcion = (descripcion?.trim() || null) as any
      }
      // Sincronizar campo.nombre en los caballos que lo tienen asignado
      MOCK_CABALLOS.forEach((cab) => {
        if (cab.campo_id === id && cab.campo) {
          cab.campo = { nombre: nombre.trim() }
        }
      })
      return
    }

    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('campo')
      .update({ nombre: nombre.trim(), descripcion: descripcion?.trim() || null })
      .eq('id', id)
    if (error) throw error
  },

  async eliminar(id: string): Promise<void> {
    if (isMockMode()) {
      // Desasignar caballos que estaban en este campo
      MOCK_CABALLOS.forEach((cab) => {
        if (cab.campo_id === id) {
          cab.campo_id = null as any
          cab.campo = null as any
        }
      })
      // Eliminar del array mock
      const idx = MOCK_CAMPOS.findIndex((c) => c.id === id)
      if (idx !== -1) MOCK_CAMPOS.splice(idx, 1)
      return
    }

    const supabase = getSupabaseClient()
    // Desasignar caballos primero
    await supabase.from('caballo').update({ campo_id: null }).eq('campo_id', id)
    const { error } = await supabase.from('campo').delete().eq('id', id)
    if (error) throw error
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
