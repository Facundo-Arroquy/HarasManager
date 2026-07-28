import { getSupabaseClient } from '../lib/supabase'
import { isMockMode } from '../dev/mockMode'
import { mensajeError } from '../utils/error'
import type {
  CatTrabajoSanitario,
  TrabajoSanitario,
  NuevoTrabajoSanitarioPayload,
} from '../types/sanidad'

// =============================================================================
// Mock (desarrollo local): catálogo básico + trabajos en memoria
// =============================================================================

const MOCK_CATALOGO: CatTrabajoSanitario[] = [
  { id: 'cts-1', sociedad_id: null, nombre: 'Desparasitación',      activo: true },
  { id: 'cts-2', sociedad_id: null, nombre: 'Vacunación',           activo: true },
  { id: 'cts-3', sociedad_id: null, nombre: 'Herrado',              activo: true },
  { id: 'cts-4', sociedad_id: null, nombre: 'Control odontológico', activo: true },
  { id: 'cts-5', sociedad_id: null, nombre: 'Extracción de sangre', activo: true },
]

const MOCK_TRABAJOS: TrabajoSanitario[] = []

// =============================================================================
// Service
// =============================================================================

export const sanidadService = {
  /** Catálogo de trabajos: globales + los de la sociedad. */
  async listarCatalogo(sociedadId: string): Promise<CatTrabajoSanitario[]> {
    if (isMockMode()) {
      return MOCK_CATALOGO.filter((c) => c.activo).sort((a, b) => a.nombre.localeCompare(b.nombre))
    }
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

  /** Trabajos de la sociedad con su lista de caballos. */
  async listarTrabajos(sociedadId: string): Promise<TrabajoSanitario[]> {
    if (isMockMode()) {
      return MOCK_TRABAJOS
        .filter((t) => t.sociedad_id === sociedadId)
        .sort((a, b) => b.fecha_programada.localeCompare(a.fecha_programada))
    }
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
    if (isMockMode()) {
      const nuevo: TrabajoSanitario = {
        ...payload,
        id: `ts-${Date.now()}`,
        estado: 'pendiente',
        fecha_realizado: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        caballos: caballoIds.map((cid, i) => ({
          id: `tsc-${Date.now()}-${i}`,
          trabajo_id: `ts-${Date.now()}`,
          caballo_id: cid,
          excluido: false,
          historial_id: null,
        })),
      }
      MOCK_TRABAJOS.push(nuevo)
      return nuevo
    }
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
   * Marca el trabajo como realizado. `excluidoRowIds` son ids de
   * `trabajo_sanitario_caballo` a excluir (no se les carga el trabajo).
   * Devuelve la cantidad de caballos a los que se cargó el historial.
   */
  async completarTrabajo(trabajoId: string, excluidoRowIds: string[]): Promise<number> {
    if (isMockMode()) {
      const t = MOCK_TRABAJOS.find((x) => x.id === trabajoId)
      if (!t) return 0
      let n = 0
      for (const c of t.caballos ?? []) {
        c.excluido = excluidoRowIds.includes(c.id)
        if (!c.excluido) n++
      }
      t.estado = 'realizado'
      t.fecha_realizado = new Date().toISOString().split('T')[0]
      return n
    }
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
    if (isMockMode()) {
      const t = MOCK_TRABAJOS.find((x) => x.id === trabajoId)
      if (t) t.estado = 'cancelado'
      return
    }
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('trabajo_sanitario')
      .update({ estado: 'cancelado' })
      .eq('id', trabajoId)
    if (error) throw error
  },
}
