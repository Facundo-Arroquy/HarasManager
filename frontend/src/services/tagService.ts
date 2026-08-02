import { getSupabaseClient } from '../lib/supabase'

// =============================================================================
// Tags de caballos — migración 20260802120000
// =============================================================================
// Catálogo `cat_tag` + relación M:N `caballo_tag`. Arranca con un solo tag
// ("Jugador"), pero el modelo permite sumar otros sin tocar el frontend.
// =============================================================================

export interface Tag {
  id:     number
  nombre: string
  color:  string | null
  activo: boolean
}

/** Tag que se asigna a caballos destinados o usados para juego/deporte. */
export const TAG_JUGADOR = 'Jugador'

/** Categorías que admiten tags (definición de Gero: caballos y yeguas). */
export const CATEGORIAS_CON_TAGS: string[] = ['Caballo', 'Yegua']

export const tagService = {
  async listar(): Promise<Tag[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cat_tag')
      .select('id, nombre, color, activo')
      .eq('activo', true)
      .order('nombre')
    if (error) throw error
    return (data ?? []) as Tag[]
  },

  /** Tags asignados, agrupados por caballo. */
  async porCaballos(caballoIds: string[]): Promise<Map<string, Tag[]>> {
    const mapa = new Map<string, Tag[]>()
    if (caballoIds.length === 0) return mapa

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('caballo_tag')
      .select('caballo_id, cat_tag(id, nombre, color, activo)')
      .in('caballo_id', caballoIds)
    if (error) throw error

    for (const fila of (data ?? []) as unknown as { caballo_id: string; cat_tag: Tag | null }[]) {
      if (!fila.cat_tag) continue
      const actuales = mapa.get(fila.caballo_id) ?? []
      actuales.push(fila.cat_tag)
      mapa.set(fila.caballo_id, actuales)
    }
    return mapa
  },

  async deCaballo(caballoId: string): Promise<Tag[]> {
    return (await this.porCaballos([caballoId])).get(caballoId) ?? []
  },

  /** Reemplaza los tags del caballo por la lista recibida. */
  async guardar(caballoId: string, tagIds: number[]): Promise<void> {
    const supabase = getSupabaseClient()

    const { data: actuales, error: errorLectura } = await supabase
      .from('caballo_tag')
      .select('tag_id')
      .eq('caballo_id', caballoId)
    if (errorLectura) throw errorLectura

    const previos  = new Set(((actuales ?? []) as { tag_id: number }[]).map((t) => t.tag_id))
    const deseados = new Set(tagIds)

    const aBorrar  = [...previos].filter((id) => !deseados.has(id))
    const aAgregar = [...deseados].filter((id) => !previos.has(id))

    if (aBorrar.length > 0) {
      const { error } = await supabase
        .from('caballo_tag')
        .delete()
        .eq('caballo_id', caballoId)
        .in('tag_id', aBorrar)
      if (error) throw error
    }

    if (aAgregar.length > 0) {
      const { error } = await supabase
        .from('caballo_tag')
        .insert(aAgregar.map((tag_id) => ({ caballo_id: caballoId, tag_id })))
      if (error) throw error
    }
  },
}
