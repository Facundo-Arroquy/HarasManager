import { getSupabaseClient } from '../lib/supabase'

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
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('campo')
      .select('id, nombre, descripcion, sociedad_id')
      .eq('sociedad_id', sociedadId)
      .order('nombre')
    if (error) throw error

    const campos = await Promise.all(
      (data ?? []).map(async (c: { id: string; nombre: string; descripcion: string | null; sociedad_id: string }) => {
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
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('campo')
      .update({ nombre: nombre.trim(), descripcion: descripcion?.trim() || null })
      .eq('id', id)
    if (error) throw error
  },

  async eliminar(id: string): Promise<void> {
    const supabase = getSupabaseClient()
    // Desasignar caballos primero
    await supabase.from('caballo').update({ campo_id: null }).eq('campo_id', id)
    const { error } = await supabase.from('campo').delete().eq('id', id)
    if (error) throw error
  },

  async asignarCaballo(caballoId: string, campoId: string | null): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('caballo')
      .update({ campo_id: campoId })
      .eq('id', caballoId)
    if (error) throw error
  },
}
