import { getSupabaseClient } from '../lib/supabase'
import { mensajeError } from '../utils/error'
import type {
  CatTrabajoSanitario,
  TrabajoSanitario,
  NuevoTrabajoSanitarioPayload,
  EstadoCaballoTrabajo,
  CaballoSinAcceso,
  ItemPlanSanitario,
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
          id, trabajo_id, caballo_id, excluido, estado, historial_id,
          caballo:caballo_id(nombre, numero_registro)
        )
      `)
      .order('fecha_programada', { ascending: false })
    if (error) throw error
    return data as TrabajoSanitario[]
  },

  /**
   * Trabajos de la sociedad con su lista de caballos.
   *
   * Trae el creador para que el admin vea qué veterinario le programó un
   * trabajo sobre sus caballos. El embed funciona porque
   * `authenticated_read_veterinarios` deja leer las filas de vets, y
   * `usuario_select_admin` las de la propia sociedad — al revés (un vet
   * leyendo a un admin) la RLS lo niega, por eso `listarTrabajosVet` resuelve
   * el origen por empresa y no por persona.
   */
  async listarTrabajos(sociedadId: string): Promise<TrabajoSanitario[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('trabajo_sanitario')
      .select(`
        *,
        creador:usuario!creado_por(nombre, apellido, rol),
        caballos:trabajo_sanitario_caballo(
          id, trabajo_id, caballo_id, excluido, estado, historial_id,
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

    // Todos los trabajos de la misma carga comparten plan: así se abren después
    // como una sola grilla caballo × trabajo.
    const planId = crypto.randomUUID()
    const { data: trabajos, error } = await supabase
      .from('trabajo_sanitario')
      .insert(items.map((i) => ({ plan_id: planId, ...i.payload })))
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
   * Caballos del grupo a los que `vetId` todavía no tiene acceso. Es lo que
   * alimenta el cartel de confirmación antes de compartir un plan.
   */
  async caballosSinAcceso(vetId: string, caballoIds: string[]): Promise<CaballoSinAcceso[]> {
    if (caballoIds.length === 0) return []
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('caballos_sin_acceso_vet', {
      p_vet_id:      vetId,
      p_caballo_ids: caballoIds,
    })
    if (error) throw error
    return (data ?? []) as CaballoSinAcceso[]
  },

  /**
   * Crea el plan entero y, si viene `vetId`, lo comparte con ese veterinario en
   * la misma transacción: plan + caballos + accesos + notificación. Si el vet no
   * tiene acceso a algún caballo y `otorgarAcceso` es false, la función levanta
   * excepción y no queda nada creado.
   *
   * Devuelve el `plan_id` que agrupa los trabajos.
   */
  async crearPlanCompartido(
    items: ItemPlanSanitario[],
    vetId: string | null,
    otorgarAcceso: boolean,
  ): Promise<string> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('crear_plan_sanitario_compartido', {
      p_items:          items,
      p_vet_id:         vetId,
      p_otorgar_acceso: otorgarAcceso,
    })
    if (error) throw error
    return data as string
  },

  /**
   * Comparte trabajos ya creados. Devuelve cuántos accesos nuevos se otorgaron.
   */
  async compartirTrabajos(
    trabajoIds: string[],
    vetId: string,
    otorgarAcceso: boolean,
  ): Promise<number> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('compartir_trabajos_con_vet', {
      p_trabajo_ids:    trabajoIds,
      p_vet_id:         vetId,
      p_otorgar_acceso: otorgarAcceso,
    })
    if (error) throw error
    return (data as number) ?? 0
  },

  /** Los trabajos de un plan, con sus caballos: las columnas de la grilla. */
  async listarPlan(planId: string): Promise<TrabajoSanitario[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('trabajo_sanitario')
      .select(`
        *,
        caballos:trabajo_sanitario_caballo(
          id, trabajo_id, caballo_id, excluido, estado, historial_id,
          caballo:caballo_id(nombre, numero_registro)
        )
      `)
      .eq('plan_id', planId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data as TrabajoSanitario[]
  },

  /**
   * Guarda el resultado de cada celda del plan. Solo los 'realizado' escriben en
   * el historial clínico; devuelve cuántas filas de historial se crearon.
   */
  async cerrarPlan(
    items: { caballoRowId: string; estado: EstadoCaballoTrabajo }[],
  ): Promise<number> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('cerrar_plan_sanitario', {
      p_items: items.map((i) => ({ caballo_row_id: i.caballoRowId, estado: i.estado })),
    })
    if (error) throw error
    return (data as number) ?? 0
  },

  /**
   * Crea un plan nuevo en otra fecha con lo que quedó pendiente: un trabajo por
   * cada tipo que tenga pendientes, solo con esos caballos.
   */
  async reprogramarPendientes(
    grupos: { trabajo: TrabajoSanitario; caballoIds: string[] }[],
    fecha: string,
    creadoPor: string,
  ): Promise<TrabajoSanitario[]> {
    const conCaballos = grupos.filter((g) => g.caballoIds.length > 0)
    if (conCaballos.length === 0) return []
    return sanidadService.crearTrabajos(
      conCaballos.map((g) => ({
        payload: {
          // Uno de los dos va en NULL — lo exige `trabajo_sanitario_duenio_check`.
          sociedad_id:      g.trabajo.sociedad_id,
          vet_owner_id:     g.trabajo.vet_owner_id,
          nombre:           g.trabajo.nombre,
          fecha_programada: fecha,
          tratamiento:      g.trabajo.tratamiento,
          observaciones:    g.trabajo.observaciones,
          creado_por:       creadoPor,
          compartido_con:   g.trabajo.compartido_con,
        },
        caballoIds: g.caballoIds,
      })),
    )
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

  /**
   * Edita un trabajo todavía pendiente: nombre, fecha, tratamiento u
   * observaciones. No toca `compartido_con` (eso va por `compartirTrabajos`,
   * que además resuelve los accesos del veterinario).
   */
  async actualizarTrabajo(
    trabajoId: string,
    campos: Partial<Pick<TrabajoSanitario, 'nombre' | 'fecha_programada' | 'tratamiento' | 'observaciones'>>,
  ): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('trabajo_sanitario')
      .update(campos)
      .eq('id', trabajoId)
    if (error) throw error
  },

  /**
   * Mueve trabajos enteros a otra fecha, sin partir el plan ni tocar los
   * caballos: es "posponer todo" en vez de marcar pendiente casillero por
   * casillero. Solo aplica a los que siguen pendientes.
   */
  async reprogramarTrabajos(trabajoIds: string[], fecha: string): Promise<void> {
    if (trabajoIds.length === 0) return
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('trabajo_sanitario')
      .update({ fecha_programada: fecha })
      .in('id', trabajoIds)
      .eq('estado', 'pendiente')
    if (error) throw error
  },

  /**
   * Reemplaza la lista de caballos de un trabajo pendiente. Las filas que
   * siguen se dejan como están para no perder lo ya marcado.
   */
  async sincronizarCaballos(trabajoId: string, caballoIds: string[]): Promise<void> {
    const supabase = getSupabaseClient()
    const { data: actuales, error: errLeer } = await supabase
      .from('trabajo_sanitario_caballo')
      .select('id, caballo_id')
      .eq('trabajo_id', trabajoId)
    if (errLeer) throw errLeer

    const previos  = (actuales ?? []) as { id: string; caballo_id: string }[]
    const quedan   = new Set(caballoIds)
    const aBorrar  = previos.filter((p) => !quedan.has(p.caballo_id)).map((p) => p.id)
    const yaEstaban = new Set(previos.map((p) => p.caballo_id))
    const aSumar   = caballoIds.filter((id) => !yaEstaban.has(id))

    if (aBorrar.length > 0) {
      const { error } = await supabase.from('trabajo_sanitario_caballo').delete().in('id', aBorrar)
      if (error) throw error
    }
    if (aSumar.length > 0) {
      const { error } = await supabase
        .from('trabajo_sanitario_caballo')
        .insert(aSumar.map((cid) => ({ trabajo_id: trabajoId, caballo_id: cid })))
      if (error) throw error
    }
  },

  /**
   * Borra el trabajo y, en cascada, su lista de caballos. La RLS solo lo deja
   * pasar si sigue pendiente (o si quien borra es el admin de la empresa / el
   * vet dueño), así que nunca se lleva puesto un historial ya cargado.
   */
  async eliminarTrabajos(trabajoIds: string[]): Promise<void> {
    if (trabajoIds.length === 0) return
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('trabajo_sanitario').delete().in('id', trabajoIds)
    if (error) throw error
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
