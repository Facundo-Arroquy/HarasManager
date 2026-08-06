import { getSupabaseClient } from '../lib/supabase'
import { mensajeError } from '../utils/error'
import type {
  CatTrabajoSanitario,
  TrabajoSanitario,
  NuevoTrabajoSanitarioPayload,
} from '../types/sanidad'

export const sanidadService = {
  /** Catálogo de trabajos: globales + los de la sociedad. */
  async listarCatalogo(sociedadId: string): Promise<CatTrabajoSanitario[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cat_trabajo_sanitario')
      .select('*')
      .eq('activo', true)
      .or(`sociedad_id.is.null,sociedad_id.eq.${sociedadId}`)
      .order('nombre')
    if (error) throw error
    return data as CatTrabajoSanitario[]
  },

  /** Catálogo global (para veterinarios, que no tienen sociedad fija). */
  async listarCatalogoGlobales(): Promise<CatTrabajoSanitario[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cat_trabajo_sanitario')
      .select('*')
      .eq('activo', true)
      .is('sociedad_id', null)
      .order('nombre')
    if (error) throw error
    return data as CatTrabajoSanitario[]
  },

  /** Trabajos del veterinario autenticado (los que creó — vía RLS). */
  async listarTrabajosVet(): Promise<TrabajoSanitario[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('trabajo_sanitario')
      .select(`
        *,
        caballos:trabajo_sanitario_caballo(
          id, trabajo_id, caballo_id, excluido, historial_id,
          caballo:caballo_id(nombre, numero_registro)
        )
      `)
      .order('fecha_programada', { ascending: false })
    if (error) throw error
    return data as TrabajoSanitario[]
  },

  /** Trabajos de la sociedad con su lista de caballos. */
  async listarTrabajos(sociedadId: string): Promise<TrabajoSanitario[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('trabajo_sanitario')
      .select(`
        *,
        caballos:trabajo_sanitario_caballo(
          id, trabajo_id, caballo_id, excluido, historial_id,
          caballo:caballo_id(nombre, numero_registro)
        )
      `)
      .eq('sociedad_id', sociedadId)
      .order('fecha_programada', { ascending: false })
    if (error) throw error
    return data as TrabajoSanitario[]
  },

  /** Crea el trabajo y su lista de caballos. */
  async crearTrabajo(
    payload: NuevoTrabajoSanitarioPayload,
    caballoIds: string[],
  ): Promise<TrabajoSanitario> {
    const supabase = getSupabaseClient()
    const { data: trabajo, error } = await supabase
      .from('trabajo_sanitario')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw error

    if (caballoIds.length > 0) {
      const filas = caballoIds.map((cid) => ({ trabajo_id: trabajo.id, caballo_id: cid }))
      const { error: errCab } = await supabase.from('trabajo_sanitario_caballo').insert(filas)
      if (errCab) {
        throw new Error(
          `El trabajo se creó pero no se pudo cargar la lista de caballos: ${mensajeError(errCab)}`,
          { cause: errCab },
        )
      }
    }
    return trabajo as TrabajoSanitario
  },

  /**
   * Crea varios trabajos de una (ej: 3 vacunas en 3 fechas) para un mismo grupo
   * de caballos. Cada item lleva su propia lista porque, cuando el veterinario
   * mezcla empresas, el grupo se desdobla en un trabajo por sociedad.
   */
  async crearTrabajos(
    items: { payload: NuevoTrabajoSanitarioPayload; caballoIds: string[] }[],
  ): Promise<TrabajoSanitario[]> {
    if (items.length === 0) return []
    const supabase = getSupabaseClient()

    const { data: trabajos, error } = await supabase
      .from('trabajo_sanitario')
      .insert(items.map((i) => i.payload))
      .select('*')
    if (error) throw error

    // PostgREST devuelve las filas en el mismo orden en que se insertaron.
    const filas = (trabajos as TrabajoSanitario[]).flatMap((t, idx) =>
      items[idx].caballoIds.map((cid) => ({ trabajo_id: t.id, caballo_id: cid })),
    )
    if (filas.length > 0) {
      const { error: errCab } = await supabase.from('trabajo_sanitario_caballo').insert(filas)
      if (errCab) {
        throw new Error(
          `Los planes se crearon pero no se pudo cargar la lista de caballos: ${mensajeError(errCab)}`,
          { cause: errCab },
        )
      }
    }
    return trabajos as TrabajoSanitario[]
  },

  /**
   * Marca el trabajo como realizado. `excluidoRowIds` son ids de
   * `trabajo_sanitario_caballo` a excluir (no se les carga el trabajo).
   * Devuelve la cantidad de caballos a los que se cargó el historial.
   */
  async completarTrabajo(trabajoId: string, excluidoRowIds: string[]): Promise<number> {
    const supabase = getSupabaseClient()
    if (excluidoRowIds.length > 0) {
      const { error: errExc } = await supabase
        .from('trabajo_sanitario_caballo')
        .update({ excluido: true })
        .in('id', excluidoRowIds)
      if (errExc) throw errExc
    }
    const { data, error } = await supabase.rpc('completar_trabajo_sanitario', {
      p_trabajo_id: trabajoId,
    })
    if (error) throw error
    return (data as number) ?? 0
  },

  async cancelarTrabajo(trabajoId: string): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('trabajo_sanitario')
      .update({ estado: 'cancelado' })
      .eq('id', trabajoId)
    if (error) throw error
  },
}
