import { getSupabaseClient } from '../lib/supabase'
import { isMockMode } from '../dev/mockMode'
import type {
  RegistroClinicoCria,
  NuevoRegistroCriaPayload,
  RecordatorioCria,
  NuevoRecordatorioPayload,
  EstadoRecordatorio,
  Flushing,
  NuevoFlushingPayload,
  Embrion,
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
} from '../types/crianza'
import { PLAZOS_VET_DEFAULTS } from '../types/crianza'

// =============================================================================
// Mock data — cargada lazy para no contaminar el bundle en producción
// =============================================================================

// Usamos los caballos del mock existente:
//   cab-002 Tormenta  → Donante
//   cab-006 Brisa     → Receptora
//   cab-003 Relámpago → Padrillo

const MOCK_REGISTROS: RegistroClinicoCria[] = [
  {
    id: 'rclin-001',
    caballo_id: 'cab-002',
    sociedad_id: 'mock-sociedad-001',
    fecha: '2026-05-05',
    veterinario_id: 'mock-vet-001',
    ovario_izq: ['35'],
    ovario_der: ['Chico'],
    utero: ['C/T'],
    obs_chips: ['Strelin'],
    padrillo_id: 'cab-003',
    ov_dias: null,
    review_manana: false,
    review_manana_desc: null,
    motivo: null,
    diagnostico: null,
    tratamiento: null,
    observaciones: null,
    created_at: '2026-05-05T09:00:00Z',
    updated_at: '2026-05-05T09:00:00Z',
    caballo: { nombre: 'Tormenta', rol_reproductivo: 'Donante' },
    veterinario: { nombre: 'Valentina', apellido: 'Ríos' },
    padrillo: { nombre: 'Relámpago' },
  },
  {
    id: 'rclin-002',
    caballo_id: 'cab-002',
    sociedad_id: 'mock-sociedad-001',
    fecha: '2026-05-06',
    veterinario_id: 'mock-vet-001',
    ovario_izq: ['40'],
    ovario_der: ['Chico'],
    utero: ['C/T'],
    obs_chips: ['IN'],
    padrillo_id: 'cab-003',
    ov_dias: null,
    review_manana: false,
    review_manana_desc: null,
    motivo: null,
    diagnostico: null,
    tratamiento: null,
    observaciones: null,
    created_at: '2026-05-06T09:00:00Z',
    updated_at: '2026-05-06T09:00:00Z',
    caballo: { nombre: 'Tormenta', rol_reproductivo: 'Donante' },
    veterinario: { nombre: 'Valentina', apellido: 'Ríos' },
    padrillo: { nombre: 'Relámpago' },
  },
  {
    id: 'rclin-003',
    caballo_id: 'cab-002',
    sociedad_id: 'mock-sociedad-001',
    fecha: '2026-05-07',
    veterinario_id: 'mock-vet-001',
    ovario_izq: ['OV'],
    ovario_der: ['Chico'],
    utero: ['C/T'],
    obs_chips: ['OXI'],
    padrillo_id: null,
    ov_dias: 0,
    review_manana: false,
    review_manana_desc: null,
    motivo: null,
    diagnostico: null,
    tratamiento: null,
    observaciones: null,
    created_at: '2026-05-07T09:00:00Z',
    updated_at: '2026-05-07T09:00:00Z',
    caballo: { nombre: 'Tormenta', rol_reproductivo: 'Donante' },
    veterinario: { nombre: 'Valentina', apellido: 'Ríos' },
    padrillo: null,
  },
  {
    id: 'rclin-004',
    caballo_id: 'cab-006',
    sociedad_id: 'mock-sociedad-001',
    fecha: '2026-05-13',
    veterinario_id: 'mock-vet-001',
    ovario_izq: ['CLV'],
    ovario_der: ['Chico'],
    utero: ['C/T', 'Ed-1'],
    obs_chips: ['Transferida'],
    padrillo_id: null,
    ov_dias: null,
    review_manana: false,
    review_manana_desc: null,
    motivo: null,
    diagnostico: null,
    tratamiento: null,
    observaciones: null,
    created_at: '2026-05-13T11:00:00Z',
    updated_at: '2026-05-13T11:00:00Z',
    caballo: { nombre: 'Brisa', rol_reproductivo: 'Receptora' },
    veterinario: { nombre: 'Valentina', apellido: 'Ríos' },
    padrillo: null,
  },
]

const MOCK_RECORDATORIOS: RecordatorioCria[] = [
  {
    id: 'rem-001',
    caballo_id: 'cab-002',
    sociedad_id: 'mock-sociedad-001',
    tipo: 'IN',
    fecha_vto: '2026-05-06',
    estado: 'hecho',
    veterinario_id: 'mock-vet-001',
    notas: null,
    auto_generado: true,
    origen_registro_id: 'rclin-001',
    cancel_motivo: null,
    created_at: '2026-05-05T09:00:00Z',
    updated_at: '2026-05-06T09:00:00Z',
    caballo: { nombre: 'Tormenta', rol_reproductivo: 'Donante' },
  },
  {
    id: 'rem-002',
    caballo_id: 'cab-002',
    sociedad_id: 'mock-sociedad-001',
    tipo: 'OXI',
    fecha_vto: '2026-05-07',
    estado: 'hecho',
    veterinario_id: 'mock-vet-001',
    notas: null,
    auto_generado: true,
    origen_registro_id: 'rclin-002',
    cancel_motivo: null,
    created_at: '2026-05-06T09:00:00Z',
    updated_at: '2026-05-07T09:00:00Z',
    caballo: { nombre: 'Tormenta', rol_reproductivo: 'Donante' },
  },
  {
    id: 'rem-003',
    caballo_id: 'cab-002',
    sociedad_id: 'mock-sociedad-001',
    tipo: 'Flushing',
    fecha_vto: '2026-05-13',
    estado: 'hecho',
    veterinario_id: 'mock-vet-001',
    notas: null,
    auto_generado: true,
    origen_registro_id: 'rclin-003',
    cancel_motivo: null,
    created_at: '2026-05-07T09:00:00Z',
    updated_at: '2026-05-13T11:00:00Z',
    caballo: { nombre: 'Tormenta', rol_reproductivo: 'Donante' },
  },
  {
    id: 'rem-004',
    caballo_id: 'cab-002',
    sociedad_id: 'mock-sociedad-001',
    tipo: 'Revisión Flushing',
    fecha_vto: '2026-05-19',
    estado: 'pendiente',
    veterinario_id: 'mock-vet-001',
    notas: null,
    auto_generado: true,
    origen_registro_id: 'rclin-003',
    cancel_motivo: null,
    created_at: '2026-05-13T11:00:00Z',
    updated_at: '2026-05-13T11:00:00Z',
    caballo: { nombre: 'Tormenta', rol_reproductivo: 'Donante' },
  },
]

const MOCK_FLUSHINGS: Flushing[] = [
  {
    id: 'flush-001',
    caballo_id: 'cab-002',
    sociedad_id: 'mock-sociedad-001',
    fecha: '2026-05-13',
    veterinario_id: 'mock-vet-001',
    es_negativo: false,
    cantidad: 2,
    padrillo_id: 'cab-003',
    origen_recordatorio_id: 'rem-003',
    pg_given: false,
    cancelado: false,
    notas: null,
    created_at: '2026-05-13T11:00:00Z',
    updated_at: '2026-05-13T11:00:00Z',
    caballo: { nombre: 'Tormenta' },
    padrillo: { nombre: 'Relámpago' },
    veterinario: { nombre: 'Valentina', apellido: 'Ríos' },
  },
]

const MOCK_TRANSFERENCIAS: TransferenciaEmbrionaria[] = [
  {
    id: 'transf-001',
    sociedad_id: 'mock-sociedad-001',
    fecha: '2026-05-13',
    veterinario_id: 'mock-vet-001',
    registro_id: 'rclin-004',
    caballo_receptora_id: 'cab-006',
    caballo_donante_id: 'cab-002',
    padrillo_id: 'cab-003',
    flushing_id: 'flush-001',
    embrion_id: null,
    cl_calidad: 'Buena',
    tono_uterino: 'Bueno',
    tono_cervical: 'Normal',
    clasificacion: 'Fresco',
    notas: null,
    created_at: '2026-05-13T11:30:00Z',
    updated_at: '2026-05-13T11:30:00Z',
    receptora: { nombre: 'Brisa' },
    donante: { nombre: 'Tormenta' },
    padrillo: { nombre: 'Relámpago' },
    veterinario: { nombre: 'Valentina', apellido: 'Ríos' },
  },
]

const MOCK_ECOGRAFIAS: Ecografia[] = []

// =============================================================================
// Service
// =============================================================================

export const crianzaService = {

  // ── Registros clínicos ────────────────────────────────────────────────────

  async listarRegistros(sociedadId: string): Promise<RegistroClinicoCria[]> {
    if (isMockMode()) {
      return MOCK_REGISTROS.filter((r) => r.sociedad_id === sociedadId)
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
    }
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
    if (isMockMode()) {
      return MOCK_REGISTROS.filter((r) => r.caballo_id === caballoId)
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
    }
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
    if (isMockMode()) {
      const nuevo: RegistroClinicoCria = {
        ...payload,
        id: `rclin-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      MOCK_REGISTROS.unshift(nuevo)
      return nuevo
    }
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
    if (isMockMode()) {
      const idx = MOCK_REGISTROS.findIndex((r) => r.id === id)
      if (idx !== -1) Object.assign(MOCK_REGISTROS[idx], payload)
      return
    }
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('cria_registro_clinico')
      .update(payload)
      .eq('id', id)
    if (error) throw error
  },

  // ── Recordatorios ─────────────────────────────────────────────────────────

  async listarRecordatorios(sociedadId: string): Promise<RecordatorioCria[]> {
    if (isMockMode()) {
      return MOCK_RECORDATORIOS.filter((r) => r.sociedad_id === sociedadId)
        .sort((a, b) => a.fecha_vto.localeCompare(b.fecha_vto))
    }
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
    if (isMockMode()) {
      const nuevo: RecordatorioCria = {
        ...payload,
        id: `rem-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      MOCK_RECORDATORIOS.push(nuevo)
      return nuevo
    }
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
    if (isMockMode()) {
      const now = Date.now()
      const nuevos = payloads.map((payload, i): RecordatorioCria => ({
        ...payload,
        id: `rem-${now}-${i}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))
      MOCK_RECORDATORIOS.push(...nuevos)
      return nuevos
    }
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cria_recordatorio')
      .insert(payloads)
      .select(`*, caballo(nombre, rol_reproductivo)`)
    if (error) throw error
    return data as RecordatorioCria[]
  },

  async marcarVencidos(ids: string[]): Promise<void> {
    if (isMockMode()) {
      ids.forEach((id) => {
        const rec = MOCK_RECORDATORIOS.find((r) => r.id === id)
        if (rec) rec.estado = 'vencido'
      })
      return
    }
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
    if (isMockMode()) {
      const rec = MOCK_RECORDATORIOS.find((r) => r.id === id)
      if (rec) {
        rec.estado = estado
        if (cancelMotivo) rec.cancel_motivo = cancelMotivo
      }
      return
    }
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('cria_recordatorio')
      .update({ estado, ...(cancelMotivo ? { cancel_motivo: cancelMotivo } : {}) })
      .eq('id', id)
    if (error) throw error
  },

  // ── Flushings ─────────────────────────────────────────────────────────────

  async listarFlushings(sociedadId: string): Promise<Flushing[]> {
    if (isMockMode()) {
      return MOCK_FLUSHINGS.filter((f) => f.sociedad_id === sociedadId)
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
    }
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
    if (isMockMode()) {
      const nuevo: Flushing = {
        ...payload,
        id: `flush-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      MOCK_FLUSHINGS.unshift(nuevo)
      return nuevo
    }
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

  async listarTodosEmbriones(sociedadId: string): Promise<Embrion[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('embrion')
      .select(`
        *,
        donante:caballo_donante_id(nombre),
        padrillo:padrillo_id(nombre),
        cria_transferencia!embrion_id(fecha, receptora:caballo_receptora_id(nombre))
      `)
      .eq('sociedad_id', sociedadId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data as Embrion[]
  },

  async listarTodosEmbrionesVet(): Promise<Embrion[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('embrion')
      .select(`
        *,
        donante:caballo_donante_id(nombre),
        padrillo:padrillo_id(nombre),
        cria_transferencia!embrion_id(fecha, receptora:caballo_receptora_id(nombre))
      `)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data as Embrion[]
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
    if (isMockMode()) {
      const idx = MOCK_FLUSHINGS.findIndex((f) => f.id === id)
      if (idx !== -1) Object.assign(MOCK_FLUSHINGS[idx], payload)
      return
    }
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('cria_flushing').update(payload).eq('id', id)
    if (error) throw error
  },

  // ── Transferencias ────────────────────────────────────────────────────────

  async listarTransferencias(sociedadId: string): Promise<TransferenciaEmbrionaria[]> {
    if (isMockMode()) {
      return MOCK_TRANSFERENCIAS.filter((t) => t.sociedad_id === sociedadId)
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
    }
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
    const { data, error } = await supabase.rpc('get_caballos_veterinario')
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
    if (isMockMode()) {
      const { MOCK_CABALLOS } = await import('../dev/mockData')
      return MOCK_CABALLOS
        .filter((c) => c.sociedad_id === sociedadId && c.activo)
        .map((c) => ({
          id:               c.id,
          nombre:           c.nombre,
          categoria:        c.categoria,
          rol_reproductivo: (c.rol_reproductivo ?? null) as RolReproductivo,
          campo:            c.campo ? { nombre: c.campo.nombre } : null,
          marca:            null as { nombre: string } | null,
        }))
    }
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
    if (isMockMode()) {
      return MOCK_FLUSHINGS.filter((f) => f.caballo_id === caballoId)
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
    }
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
    if (isMockMode()) {
      return MOCK_TRANSFERENCIAS.filter(
        (t) => t.caballo_receptora_id === caballoId || t.caballo_donante_id === caballoId
      ).sort((a, b) => b.fecha.localeCompare(a.fecha))
    }
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
    if (isMockMode()) {
      return MOCK_ECOGRAFIAS.filter((e) => e.sociedad_id === sociedadId)
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
    }
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
    if (isMockMode()) {
      const nueva: Ecografia = {
        ...payload,
        id: `eco-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      MOCK_ECOGRAFIAS.push(nueva)
      const { MOCK_CABALLOS } = await import('../dev/mockData')
      const cab = MOCK_CABALLOS.find((c) => c.id === payload.caballo_receptora_id)
      if (cab) {
        if (payload.resultado === 'abortada')      cab.estado_reproductivo = 'vacia'
        else if (payload.resultado === 'prenada')  cab.estado_reproductivo = 'prenada'
      }
      return nueva
    }
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
    if (isMockMode()) {
      const { MOCK_CABALLOS } = await import('../dev/mockData')
      const cab = MOCK_CABALLOS.find((c) => c.id === caballoId)
      if (cab) cab.rol_reproductivo = rol
      return
    }
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
    if (isMockMode()) {
      const { MOCK_CABALLOS } = await import('../dev/mockData')
      const cab = MOCK_CABALLOS.find((c) => c.id === caballoId)
      if (cab) cab.estado_reproductivo = estadoNuevo
      return
    }
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
}
