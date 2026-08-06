import { getSupabaseClient } from '../lib/supabase'
import type {
  RegistroClinicoCria,
  NuevoRegistroCriaPayload,
  RecordatorioCria,
  NuevoRecordatorioPayload,
  EstadoRecordatorio,
  Flushing,
  NuevoFlushingPayload,
  Embrion,
  EmbrionConSeguimiento,
  NuevoEmbrionPayload,
  TransferenciaEmbrionaria,
  RegistrarTransferenciaPayload,
  Ecografia,
  NuevaEcografiaPayload,
  RolReproductivo,
  EstadoReproductivo,
  CatChipObs,
  NuevoCatChipObsPayload,
  PlazosVet,
  PadrilloPreferido,
} from '../types/crianza'
import { PLAZOS_VET_DEFAULTS } from '../types/crianza'

/**
 * Embrión + transferencia + ecografías de esa transferencia. El embed de
 * transferencia viene vacío para los embriones que nunca se transfirieron
 * (disponibles, vitrificados o descartados), así que la lista los muestra sin
 * receptora.
 */
const SELECT_EMBRION_SEGUIMIENTO = `
  *,
  donante:caballo_donante_id(nombre),
  padrillo:padrillo_id(nombre),
  cria_transferencia!embrion_id(
    fecha,
    receptora:caballo_receptora_id(nombre, pelaje:pelaje_id(nombre)),
    cria_ecografia!transferencia_id(numero, fecha, resultado)
  )
`

// =============================================================================
// Service
// =============================================================================

export const crianzaService = {

  // ── Registros clínicos ────────────────────────────────────────────────────

  async listarRegistros(sociedadId: string): Promise<RegistroClinicoCria[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cria_registro_clinico')
      .select(`
        *,
        caballo:caballo_id(nombre, rol_reproductivo),
        veterinario:veterinario_id(nombre, apellido),
        padrillo:padrillo_id(nombre)
      `)
      .eq('sociedad_id', sociedadId)
      .order('fecha', { ascending: false })
    if (error) throw error
    return data as RegistroClinicoCria[]
  },

  async listarRegistrosPorCaballo(caballoId: string): Promise<RegistroClinicoCria[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cria_registro_clinico')
      .select(`
        *,
        caballo:caballo_id(nombre, rol_reproductivo),
        veterinario:veterinario_id(nombre, apellido),
        padrillo:padrillo_id(nombre)
      `)
      .eq('caballo_id', caballoId)
      .order('fecha', { ascending: false })
    if (error) throw error
    return data as RegistroClinicoCria[]
  },

  async crearRegistro(payload: NuevoRegistroCriaPayload): Promise<RegistroClinicoCria> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cria_registro_clinico')
      .insert(payload)
      .select(`
        *,
        caballo:caballo_id(nombre, rol_reproductivo),
        veterinario:veterinario_id(nombre, apellido),
        padrillo:padrillo_id(nombre)
      `)
      .single()
    if (error) throw error
    return data as RegistroClinicoCria
  },

  async actualizarRegistro(
    id: string,
    payload: Partial<NuevoRegistroCriaPayload>
  ): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('cria_registro_clinico')
      .update(payload)
      .eq('id', id)
    if (error) throw error
  },

  // ── Recordatorios ─────────────────────────────────────────────────────────

  async listarRecordatorios(sociedadId: string): Promise<RecordatorioCria[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cria_recordatorio')
      .select(`*, caballo(nombre, rol_reproductivo)`)
      .eq('sociedad_id', sociedadId)
      .order('fecha_vto')
    if (error) throw error
    return data as RecordatorioCria[]
  },

  async crearRecordatorio(payload: NuevoRecordatorioPayload): Promise<RecordatorioCria> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cria_recordatorio')
      .insert(payload)
      .select(`*, caballo(nombre, rol_reproductivo)`)
      .single()
    if (error) throw error
    return data as RecordatorioCria
  },

  async crearRecordatoriosBatch(payloads: NuevoRecordatorioPayload[]): Promise<RecordatorioCria[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cria_recordatorio')
      .insert(payloads)
      .select(`*, caballo(nombre, rol_reproductivo)`)
    if (error) throw error
    return data as RecordatorioCria[]
  },

  async marcarVencidos(ids: string[]): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('cria_recordatorio')
      .update({ estado: 'vencido' })
      .in('id', ids)
    if (error) throw error
  },

  async actualizarEstadoRecordatorio(
    id: string,
    estado: EstadoRecordatorio,
    cancelMotivo?: string
  ): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('cria_recordatorio')
      .update({ estado, ...(cancelMotivo ? { cancel_motivo: cancelMotivo } : {}) })
      .eq('id', id)
    if (error) throw error
  },

  // ── Flushings ─────────────────────────────────────────────────────────────

  async listarFlushings(sociedadId: string): Promise<Flushing[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cria_flushing')
      .select(`
        *,
        caballo:caballo_id(nombre),
        padrillo:padrillo_id(nombre),
        veterinario:veterinario_id(nombre, apellido)
      `)
      .eq('sociedad_id', sociedadId)
      .order('fecha', { ascending: false })
    if (error) throw error
    return data as Flushing[]
  },

  async crearFlushing(payload: NuevoFlushingPayload): Promise<Flushing> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cria_flushing')
      .insert(payload)
      .select(`
        *,
        caballo:caballo_id(nombre),
        padrillo:padrillo_id(nombre),
        veterinario:veterinario_id(nombre, apellido)
      `)
      .single()
    if (error) throw error
    return data as Flushing
  },

  async crearEmbriones(payloads: NuevoEmbrionPayload[]): Promise<Embrion[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('embrion')
      .insert(payloads)
      .select('*')
    if (error) throw error
    return data as Embrion[]
  },

  async listarTodosEmbriones(sociedadId: string): Promise<EmbrionConSeguimiento[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('embrion')
      .select(SELECT_EMBRION_SEGUIMIENTO)
      .eq('sociedad_id', sociedadId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data as unknown as EmbrionConSeguimiento[]
  },

  async listarTodosEmbrionesVet(): Promise<EmbrionConSeguimiento[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('embrion')
      .select(SELECT_EMBRION_SEGUIMIENTO)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data as unknown as EmbrionConSeguimiento[]
  },

  async listarEmbrionesDisponibles(sociedadId: string, donanteId?: string): Promise<Embrion[]> {
    const supabase = getSupabaseClient()
    let q = supabase
      .from('embrion')
      .select(`*, donante:caballo_donante_id(nombre), padrillo:padrillo_id(nombre)`)
      .eq('sociedad_id', sociedadId)
      .in('estado', ['disponible', 'congelado'])
      .order('created_at', { ascending: false })
    if (donanteId) q = q.eq('caballo_donante_id', donanteId)
    const { data, error } = await q
    if (error) throw error
    return data as Embrion[]
  },

  async actualizarFlushing(id: string, payload: Partial<NuevoFlushingPayload>): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('cria_flushing').update(payload).eq('id', id)
    if (error) throw error
  },

  // ── Transferencias ────────────────────────────────────────────────────────

  async listarTransferencias(sociedadId: string): Promise<TransferenciaEmbrionaria[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cria_transferencia')
      .select(`
        *,
        receptora:caballo_receptora_id(nombre),
        donante:caballo_donante_id(nombre),
        padrillo:padrillo_id(nombre),
        veterinario:veterinario_id(nombre, apellido)
      `)
      .eq('sociedad_id', sociedadId)
      .order('fecha', { ascending: false })
    if (error) throw error
    return data as TransferenciaEmbrionaria[]
  },

  /**
   * Registra la transferencia completa en una sola transacción: registro clínico
   * de la receptora con chip "Transferida", fila en cria_transferencia y embrión
   * descontado a 'transferido'.
   *
   * Reemplaza la secuencia de tres llamadas sueltas que podía dejar la
   * transferencia creada con el embrión todavía disponible. La RPC además toma
   * un lock sobre el embrión, así que dos vets no pueden transferir el mismo.
   */
  async registrarTransferenciaEmbrionaria(
    payload: RegistrarTransferenciaPayload
  ): Promise<TransferenciaEmbrionaria> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('registrar_transferencia_embrionaria', {
      p_sociedad_id:          payload.sociedad_id,
      p_fecha:                payload.fecha,
      p_caballo_receptora_id: payload.caballo_receptora_id,
      p_caballo_donante_id:   payload.caballo_donante_id,
      p_embrion_id:           payload.embrion_id,
      p_padrillo_id:          payload.padrillo_id,
      p_flushing_id:          payload.flushing_id,
      p_ovario_izq:           payload.ovario_izq,
      p_ovario_der:           payload.ovario_der,
      p_cl_calidad:           payload.cl_calidad,
      p_tono_uterino:         payload.tono_uterino,
      p_tono_cervical:        payload.tono_cervical,
      p_clasificacion:        payload.clasificacion,
      p_notas:                payload.notas,
    })
    if (error) throw error

    const ids = data as { transferencia_id: string }
    const { data: transferencia, error: errorFetch } = await supabase
      .from('cria_transferencia')
      .select(`
        *,
        receptora:caballo_receptora_id(nombre),
        donante:caballo_donante_id(nombre),
        padrillo:padrillo_id(nombre),
        veterinario:veterinario_id(nombre, apellido)
      `)
      .eq('id', ids.transferencia_id)
      .single()
    if (errorFetch) throw errorFetch
    return transferencia as TransferenciaEmbrionaria
  },

  // ── Métodos sin filtro de sociedad — para veterinarios sin membresía ─────

  async listarRegistrosVet(): Promise<RegistroClinicoCria[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cria_registro_clinico')
      .select(`
        *,
        caballo:caballo_id(nombre, rol_reproductivo),
        veterinario:veterinario_id(nombre, apellido),
        padrillo:padrillo_id(nombre)
      `)
      .order('fecha', { ascending: false })
    if (error) throw error
    return data as RegistroClinicoCria[]
  },

  async listarRecordatoriosVet(): Promise<RecordatorioCria[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cria_recordatorio')
      .select(`*, caballo(nombre, rol_reproductivo)`)
      .order('fecha_vto')
    if (error) throw error
    return data as RecordatorioCria[]
  },

  async listarFlushingsVet(): Promise<Flushing[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cria_flushing')
      .select(`
        *,
        caballo:caballo_id(nombre),
        padrillo:padrillo_id(nombre),
        veterinario:veterinario_id(nombre, apellido)
      `)
      .order('fecha', { ascending: false })
    if (error) throw error
    return data as Flushing[]
  },

  async listarTransferenciasVet(): Promise<TransferenciaEmbrionaria[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cria_transferencia')
      .select(`
        *,
        receptora:caballo_receptora_id(nombre),
        donante:caballo_donante_id(nombre),
        padrillo:padrillo_id(nombre),
        veterinario:veterinario_id(nombre, apellido)
      `)
      .order('fecha', { ascending: false })
    if (error) throw error
    return data as TransferenciaEmbrionaria[]
  },

  async listarAnimalesReproductivosVet() {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('get_caballos_veterinario_cria')
    if (error) throw error
    return (data ?? []).map((d: Record<string, unknown>) => ({
      id:               d.id as string,
      nombre:           d.nombre as string,
      categoria:        d.categoria as string,
      rol_reproductivo: d.rol_reproductivo as RolReproductivo,
      sociedad_id:      d.sociedad_id as string,
      campo:            d.campo_nombre ? { nombre: d.campo_nombre as string } : null,
      marca:            d.propietario_nombre
                          ? { nombre: d.propietario_nombre as string }
                          : d.empresa_nombre
                            ? { nombre: d.empresa_nombre as string }
                            : null,
    }))
  },

  // ── Animales del módulo (con rol_reproductivo) ───────────────────────────

  async listarAnimalesReproductivos(sociedadId: string) {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('caballo')
      .select('id, nombre, categoria, rol_reproductivo, campo(nombre)')
      .eq('sociedad_id', sociedadId)
      .eq('activo', true)
      .order('nombre')
    if (error) throw error
    return (data as unknown) as Array<{
      id: string
      nombre: string
      categoria: string
      rol_reproductivo: RolReproductivo
      campo: { nombre: string } | null
    }>
  },

  // ── Rol reproductivo en caballo ───────────────────────────────────────────

  async listarFlushingsPorCaballo(caballoId: string): Promise<Flushing[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cria_flushing')
      .select(`
        *,
        caballo:caballo_id(nombre),
        padrillo:padrillo_id(nombre),
        veterinario:veterinario_id(nombre, apellido)
      `)
      .eq('caballo_id', caballoId)
      .order('fecha', { ascending: false })
    if (error) throw error
    return data as Flushing[]
  },

  async listarTransferenciasPorCaballo(caballoId: string): Promise<TransferenciaEmbrionaria[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cria_transferencia')
      .select(`
        *,
        receptora:caballo_receptora_id(nombre),
        donante:caballo_donante_id(nombre),
        padrillo:padrillo_id(nombre),
        veterinario:veterinario_id(nombre, apellido)
      `)
      .or(`caballo_receptora_id.eq.${caballoId},caballo_donante_id.eq.${caballoId}`)
      .order('fecha', { ascending: false })
    if (error) throw error
    return data as TransferenciaEmbrionaria[]
  },

  // ── Ecografías post-transferencia ────────────────────────────────────────

  async listarEcografias(sociedadId: string): Promise<Ecografia[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cria_ecografia')
      .select(`
        *,
        receptora:caballo_receptora_id(nombre),
        veterinario:veterinario_id(nombre, apellido)
      `)
      .eq('sociedad_id', sociedadId)
      .order('fecha', { ascending: false })
    if (error) throw error
    return data as Ecografia[]
  },

  async listarEcografiasVet(): Promise<Ecografia[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cria_ecografia')
      .select(`
        *,
        receptora:caballo_receptora_id(nombre),
        veterinario:veterinario_id(nombre, apellido)
      `)
      .order('fecha', { ascending: false })
    if (error) throw error
    return data as Ecografia[]
  },

  /**
   * Registra una ecografía post-transferencia y sincroniza el estado
   * reproductivo de la receptora según el resultado:
   *   - 'abortada'  → la yegua pasa a 'vacia' y vuelve al circuito de revisión
   *   - 'prenada'   → la yegua pasa a 'prenada'
   *   - 'pendiente' → sin cambio de estado (se la vuelve a revisar)
   */
  async registrarEcografia(payload: NuevaEcografiaPayload): Promise<Ecografia> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cria_ecografia')
      .insert(payload)
      .select(`
        *,
        receptora:caballo_receptora_id(nombre),
        veterinario:veterinario_id(nombre, apellido)
      `)
      .single()
    if (error) throw error

    // Sincronizar el estado reproductivo de la receptora
    const nuevoEstado: EstadoReproductivo =
      payload.resultado === 'abortada' ? 'vacia'
      : payload.resultado === 'prenada' ? 'prenada'
      : null

    if (nuevoEstado) {
      const { data: cab } = await supabase
        .from('caballo')
        .select('estado_reproductivo')
        .eq('id', payload.caballo_receptora_id)
        .single()
      const estadoAnterior = (cab?.estado_reproductivo ?? null) as EstadoReproductivo
      if (estadoAnterior !== nuevoEstado) {
        await crianzaService.actualizarEstadoReproductivo(
          payload.caballo_receptora_id,
          payload.sociedad_id,
          estadoAnterior,
          nuevoEstado,
          payload.veterinario_id,
          `Ecografía ${payload.numero}: ${payload.resultado}`,
        )
      }
    }

    return data as Ecografia
  },

  async actualizarRolReproductivo(
    caballoId: string,
    rol: RolReproductivo
  ): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('caballo')
      .update({ rol_reproductivo: rol })
      .eq('id', caballoId)
    if (error) throw error
  },

  async actualizarEstadoReproductivo(
    caballoId: string,
    sociedadId: string,
    estadoAnterior: EstadoReproductivo,
    estadoNuevo: EstadoReproductivo,
    creadoPor: string,
    motivo?: string,
  ): Promise<void> {
    const supabase = getSupabaseClient()

    // 1. Actualizar la columna en caballo
    const { error: errCaballo } = await supabase
      .from('caballo')
      .update({ estado_reproductivo: estadoNuevo })
      .eq('id', caballoId)
    if (errCaballo) throw errCaballo

    // 2. Insertar auditoría en cria_estado_transicion
    const { error: errAudit } = await supabase
      .from('cria_estado_transicion')
      .insert({
        caballo_id:     caballoId,
        sociedad_id:    sociedadId,
        estado_anterior: estadoAnterior,
        estado_nuevo:   estadoNuevo,
        motivo:         motivo ?? null,
        creado_por:     creadoPor,
      })
    if (errAudit) throw errAudit
  },

  // ── Catálogo de acciones/tratamientos (obs_chips) — por veterinario ────────
  // El RLS ya filtra por veterinario_id = auth.uid(), así que no hace falta
  // pasar el id: cada vet solo ve y edita su propia lista.

  /** Chips activos del vet autenticado. Para el selector del registro. */
  async listarMisChips(): Promise<CatChipObs[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cat_chip_obs')
      .select('*')
      .eq('activo', true)
      .order('nombre')
    if (error) throw error
    return data as CatChipObs[]
  },

  /** Todos los chips del vet autenticado, incluidos los sacados (configuración). */
  async listarMisChipsConInactivos(): Promise<CatChipObs[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cat_chip_obs')
      .select('*')
      .order('nombre')
    if (error) throw error
    return data as CatChipObs[]
  },

  async crearChipObs(payload: NuevoCatChipObsPayload): Promise<CatChipObs> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cat_chip_obs')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw error
    return data as CatChipObs
  },

  /** Saca o vuelve a poner un chip en la lista del vet (soft, reversible). */
  async actualizarChipObs(id: string, activo: boolean): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('cat_chip_obs')
      .update({ activo })
      .eq('id', id)
    if (error) throw error
  },

  // ── Plazos de recordatorios — por veterinario ──────────────────────────────

  /** Plazos del vet autenticado. Si todavía no configuró, devuelve los defaults. */
  async getMisPlazos(): Promise<PlazosVet> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cria_plazo_vet')
      .select('*')
      .maybeSingle()
    if (error) throw error
    if (!data) return PLAZOS_VET_DEFAULTS
    const fila = data as PlazosVet
    // Solo las claves de PlazosVet: la fila trae además veterinario_id y timestamps.
    return Object.fromEntries(
      Object.keys(PLAZOS_VET_DEFAULTS).map((k) => [k, fila[k as keyof PlazosVet]])
    ) as unknown as PlazosVet
  },

  /** Guarda los plazos del vet autenticado (crea la fila la primera vez). */
  async guardarMisPlazos(veterinarioId: string, plazos: PlazosVet): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('cria_plazo_vet')
      .upsert({ veterinario_id: veterinarioId, ...plazos }, { onConflict: 'veterinario_id' })
    if (error) throw error
  },

  // ── Padrillos familiares — migración 20260802120100 ────────────────────────

  /**
   * De los padrillos que la UI está mostrando, cuáles son familiares directos
   * de la donante (2 generaciones) y con qué parentesco.
   * La regla también está en un trigger de `cria_registro_clinico`: esto es
   * para poder marcarlos en rojo antes de que el vet intente guardar.
   */
  async listarPadrillosFamiliares(
    donanteId: string,
    padrilloIds: string[],
  ): Promise<Record<string, string>> {
    if (!donanteId || padrilloIds.length === 0) return {}
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('get_padrillos_familiares', {
      p_donante_id:   donanteId,
      p_padrillo_ids: padrilloIds,
    })
    if (error) throw error
    return Object.fromEntries(
      ((data ?? []) as { padrillo_id: string; parentesco: string }[])
        .map((f) => [f.padrillo_id, f.parentesco]),
    )
  },

  // ── Ranking de padrillos por donante — migración 20260802120200 ────────────

  /** Ranking de una donante, ordenado por prioridad (1 = más recomendado). */
  async listarRankingPadrillos(donanteId: string): Promise<PadrilloPreferido[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cria_padrillo_preferido')
      .select('id, donante_id, padrillo_id, prioridad, padrillo:caballo!cria_padrillo_preferido_padrillo_id_fkey(nombre)')
      .eq('donante_id', donanteId)
      .order('prioridad')
    if (error) throw error
    return ((data ?? []) as unknown as PadrilloPreferido[])
  },

  /** Rankings de todas las donantes de la sociedad (para el listado de config). */
  async listarRankingsSociedad(sociedadId: string): Promise<PadrilloPreferido[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cria_padrillo_preferido')
      .select('id, donante_id, padrillo_id, prioridad, padrillo:caballo!cria_padrillo_preferido_padrillo_id_fkey(nombre)')
      .eq('sociedad_id', sociedadId)
      .order('prioridad')
    if (error) throw error
    return ((data ?? []) as unknown as PadrilloPreferido[])
  },

  /**
   * Reemplaza el ranking completo de una donante. El orden del array es la
   * prioridad (índice 0 → prioridad 1). Va por RPC porque el reordenamiento
   * necesita borrar e insertar en una sola transacción.
   */
  async guardarRankingPadrillos(donanteId: string, padrilloIds: string[]): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase.rpc('guardar_ranking_padrillos', {
      p_donante_id:   donanteId,
      p_padrillo_ids: padrilloIds,
    })
    if (error) throw error
  },
}
