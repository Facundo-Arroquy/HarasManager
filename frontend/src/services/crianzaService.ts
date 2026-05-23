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
  TransferenciaEmbrionaria,
  NuevaTransferenciaPayload,
  RolReproductivo,
} from '../types/crianza'

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
    estadio: 'Mórula',
    grado: 1,
    tamanio: 'Mediano',
    zona_pelucida: null,
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
        caballo(nombre, rol_reproductivo),
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
        caballo(nombre, rol_reproductivo),
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
        caballo(nombre, rol_reproductivo),
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
        caballo(nombre),
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
        caballo(nombre),
        padrillo:padrillo_id(nombre),
        veterinario:veterinario_id(nombre, apellido)
      `)
      .single()
    if (error) throw error
    return data as Flushing
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

  async crearTransferencia(payload: NuevaTransferenciaPayload): Promise<TransferenciaEmbrionaria> {
    if (isMockMode()) {
      const nuevo: TransferenciaEmbrionaria = {
        ...payload,
        id: `transf-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      MOCK_TRANSFERENCIAS.unshift(nuevo)
      return nuevo
    }
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('cria_transferencia')
      .insert(payload)
      .select(`
        *,
        receptora:caballo_receptora_id(nombre),
        donante:caballo_donante_id(nombre),
        padrillo:padrillo_id(nombre),
        veterinario:veterinario_id(nombre, apellido)
      `)
      .single()
    if (error) throw error
    return data as TransferenciaEmbrionaria
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
          rol_reproductivo: (c as any).rol_reproductivo ?? null as RolReproductivo,
          campo:            c.campo ? { nombre: (c.campo as any).nombre } : null,
          marca:            c.marca ? { nombre: (c.marca as any).nombre } : null,
        }))
    }
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('caballo')
      .select('id, nombre, categoria, rol_reproductivo, campo(nombre), marca(nombre)')
      .eq('sociedad_id', sociedadId)
      .eq('activo', true)
      .order('nombre')
    if (error) throw error
    return data as Array<{
      id: string
      nombre: string
      categoria: string
      rol_reproductivo: RolReproductivo
      campo: { nombre: string } | null
      marca: { nombre: string } | null
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
        caballo(nombre),
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

  async actualizarRolReproductivo(
    caballoId: string,
    rol: RolReproductivo
  ): Promise<void> {
    if (isMockMode()) {
      const { MOCK_CABALLOS } = await import('../dev/mockData')
      const cab = MOCK_CABALLOS.find((c) => c.id === caballoId)
      if (cab) (cab as any).rol_reproductivo = rol
      return
    }
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('caballo')
      .update({ rol_reproductivo: rol })
      .eq('id', caballoId)
    if (error) throw error
  },
}
