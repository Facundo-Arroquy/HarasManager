import { create } from 'zustand'
import { crianzaService } from '../services/crianzaService'
import type {
  RegistroClinicoCria,
  RecordatorioCria,
  Flushing,
  TransferenciaEmbrionaria,
  NuevoRegistroCriaPayload,
  NuevoRecordatorioPayload,
  NuevoFlushingPayload,
  NuevaTransferenciaPayload,
  EstadoRecordatorio,
  TipoRecordatorio,
  RolReproductivo,
} from '../types/crianza'

// =============================================================================
// Auto-generación de recordatorios según chips seleccionados
//
// Tabla de reglas (fuente: lógica de negocio EquiVet):
//
// Donante:
//   Strelin → IN           +1 día
//   IN      → OXI          +1 día
//   OV      → Flushing     +6 días (configurable: ovDias)
//   PG      → Revisión PG  +3 días
//   Flushing→ Rev.Flushing +4 días
//
// Receptora:
//   Strelin → Revisión Strelin  próximo MWF
//   PG      → Revisión PG       +4 días
//   OV (sin Transferida) → Dar PG  +3 días
//
// Cualquiera:
//   review_manana = true → Revisión  próximo MWF
// =============================================================================

function proximoMWF(desde: Date): string {
  const d = new Date(desde)
  d.setDate(d.getDate() + 1)
  // 1=Lun 3=Mié 5=Vie
  while (![1, 3, 5].includes(d.getDay())) {
    d.setDate(d.getDate() + 1)
  }
  return d.toISOString().split('T')[0]
}

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(fecha + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().split('T')[0]
}

interface ReglaRecordatorio {
  tipo: TipoRecordatorio
  calcularFecha: (fecha: string) => string
}

function reglasParaRegistro(
  registro: NuevoRegistroCriaPayload,
  rolReproductivo: RolReproductivo
): ReglaRecordatorio[] {
  const chips = registro.obs_chips
  const reglas: ReglaRecordatorio[] = []
  const base = registro.fecha

  if (rolReproductivo === 'Donante') {
    if (chips.includes('Strelin'))
      reglas.push({ tipo: 'IN', calcularFecha: (f) => sumarDias(f, 1) })
    if (chips.includes('IN'))
      reglas.push({ tipo: 'OXI', calcularFecha: (f) => sumarDias(f, 1) })
    if (chips.some((c) => c === 'OV') || registro.ovario_izq.includes('OV') || registro.ovario_der.includes('OV'))
      reglas.push({ tipo: 'Flushing', calcularFecha: (f) => sumarDias(f, 6) })
    if (chips.includes('PG'))
      reglas.push({ tipo: 'Revisión PG', calcularFecha: (f) => sumarDias(f, 3) })
    if (chips.includes('Flushing'))
      reglas.push({ tipo: 'Revisión Flushing', calcularFecha: (f) => sumarDias(f, 4) })
  }

  if (rolReproductivo === 'Receptora') {
    if (chips.includes('Strelin'))
      reglas.push({ tipo: 'Revisión Strelin', calcularFecha: (f) => proximoMWF(new Date(f)) })
    if (chips.includes('PG'))
      reglas.push({ tipo: 'Revisión PG', calcularFecha: (f) => sumarDias(f, 4) })
    const tieneOV = registro.ovario_izq.includes('OV') || registro.ovario_der.includes('OV')
    const fueTransferida = chips.includes('Transferida')
    if (tieneOV && !fueTransferida)
      reglas.push({ tipo: 'Dar PG', calcularFecha: (f) => sumarDias(f, 3) })
  }

  if (registro.review_manana)
    reglas.push({ tipo: 'Revisión', calcularFecha: (f) => proximoMWF(new Date(f)) })

  return reglas.map((r) => ({ ...r, calcularFecha: () => r.calcularFecha(base) }))
}

// =============================================================================
// Store
// =============================================================================

interface CrianzaState {
  registros:      RegistroClinicoCria[]
  recordatorios:  RecordatorioCria[]
  flushings:      Flushing[]
  transferencias: TransferenciaEmbrionaria[]
  loading:        boolean
  error:          string | null

  cargar: (sociedadId: string) => Promise<void>
  cargarParaVet: () => Promise<void>

  // Registros clínicos
  crearRegistro: (
    payload: NuevoRegistroCriaPayload,
    rolReproductivo: RolReproductivo
  ) => Promise<RegistroClinicoCria>

  // Recordatorios
  actualizarEstadoRecordatorio: (
    id: string,
    estado: EstadoRecordatorio,
    cancelMotivo?: string
  ) => Promise<void>

  // Flushings
  crearFlushing: (payload: NuevoFlushingPayload) => Promise<Flushing>
  actualizarFlushing: (id: string, payload: Partial<NuevoFlushingPayload>) => Promise<void>

  // Transferencias
  crearTransferencia: (payload: NuevaTransferenciaPayload) => Promise<TransferenciaEmbrionaria>

  // Rol reproductivo
  actualizarRolReproductivo: (caballoId: string, rol: RolReproductivo) => Promise<void>

  // Sincronización de estados vencidos
  sincronizarVencidos: () => void
}

export const useCrianzaStore = create<CrianzaState>((set, get) => ({
  registros:      [],
  recordatorios:  [],
  flushings:      [],
  transferencias: [],
  loading:        false,
  error:          null,

  // ── Carga inicial ──────────────────────────────────────────────────────────

  cargar: async (sociedadId) => {
    set({ loading: true, error: null })
    try {
      const [registros, recordatorios, flushings, transferencias] = await Promise.all([
        crianzaService.listarRegistros(sociedadId),
        crianzaService.listarRecordatorios(sociedadId),
        crianzaService.listarFlushings(sociedadId),
        crianzaService.listarTransferencias(sociedadId),
      ])
      set({ registros, recordatorios, flushings, transferencias })
      get().sincronizarVencidos()
    } catch (err) {
      const msg = err instanceof Error ? err.message : (err as any)?.message ?? 'Error al cargar datos'
      set({ error: msg })
    } finally {
      set({ loading: false })
    }
  },

  cargarParaVet: async () => {
    set({ loading: true, error: null })
    try {
      const [registros, recordatorios, flushings, transferencias] = await Promise.all([
        crianzaService.listarRegistrosVet(),
        crianzaService.listarRecordatoriosVet(),
        crianzaService.listarFlushingsVet(),
        crianzaService.listarTransferenciasVet(),
      ])
      set({ registros, recordatorios, flushings, transferencias })
      get().sincronizarVencidos()
    } catch (err) {
      const msg = err instanceof Error ? err.message : (err as any)?.message ?? 'Error al cargar datos'
      set({ error: msg })
    } finally {
      set({ loading: false })
    }
  },

  // ── Registros clínicos ────────────────────────────────────────────────────

  crearRegistro: async (payload, rolReproductivo) => {
    const registro = await crianzaService.crearRegistro(payload)
    set((s) => ({ registros: [registro, ...s.registros] }))

    // Auto-generar recordatorios según chips (insert batch para evitar N+1)
    const reglas = reglasParaRegistro(payload, rolReproductivo)
    if (reglas.length > 0) {
      const recPayloads: NuevoRecordatorioPayload[] = reglas.map((regla) => ({
        caballo_id:         payload.caballo_id,
        sociedad_id:        payload.sociedad_id,
        tipo:               regla.tipo,
        fecha_vto:          regla.calcularFecha(payload.fecha),
        estado:             'pendiente' as EstadoRecordatorio,
        veterinario_id:     payload.veterinario_id,
        notas:              null,
        auto_generado:      true,
        origen_registro_id: registro.id,
        cancel_motivo:      null,
      }))
      const recs = await crianzaService.crearRecordatoriosBatch(recPayloads)
      set((s) => ({ recordatorios: [...s.recordatorios, ...recs] }))
    }

    return registro
  },

  // ── Recordatorios ─────────────────────────────────────────────────────────

  actualizarEstadoRecordatorio: async (id, estado, cancelMotivo) => {
    await crianzaService.actualizarEstadoRecordatorio(id, estado, cancelMotivo)
    set((s) => ({
      recordatorios: s.recordatorios.map((r) =>
        r.id === id
          ? { ...r, estado, ...(cancelMotivo ? { cancel_motivo: cancelMotivo } : {}) }
          : r
      ),
    }))
  },

  // ── Flushings ─────────────────────────────────────────────────────────────

  crearFlushing: async (payload) => {
    const flushing = await crianzaService.crearFlushing(payload)
    set((s) => ({ flushings: [flushing, ...s.flushings] }))
    return flushing
  },

  actualizarFlushing: async (id, payload) => {
    await crianzaService.actualizarFlushing(id, payload)
    set((s) => ({
      flushings: s.flushings.map((f) =>
        f.id === id ? { ...f, ...payload } : f
      ),
    }))
  },

  // ── Transferencias ────────────────────────────────────────────────────────

  crearTransferencia: async (payload) => {
    const transferencia = await crianzaService.crearTransferencia(payload)
    set((s) => ({ transferencias: [transferencia, ...s.transferencias] }))
    return transferencia
  },

  // ── Rol reproductivo ──────────────────────────────────────────────────────

  actualizarRolReproductivo: async (caballoId, rol) => {
    await crianzaService.actualizarRolReproductivo(caballoId, rol)
    // Refrescar los registros en memoria que tengan ese caballo
    set((s) => ({
      registros: s.registros.map((r) =>
        r.caballo_id === caballoId && r.caballo
          ? { ...r, caballo: { ...r.caballo, rol_reproductivo: rol } }
          : r
      ),
    }))
  },

  // ── Sincronización de vencidos (corre cada 60s desde el componente raíz) ──

  sincronizarVencidos: () => {
    const hoy = new Date().toISOString().split('T')[0]
    const aVencer = get().recordatorios
      .filter((r) => r.estado === 'pendiente' && r.fecha_vto < hoy)
      .map((r) => r.id)

    if (aVencer.length > 0) {
      crianzaService.marcarVencidos(aVencer).catch(() => {})
    }

    set((s) => ({
      recordatorios: s.recordatorios.map((r) =>
        r.estado === 'pendiente' && r.fecha_vto < hoy
          ? { ...r, estado: 'vencido' as EstadoRecordatorio }
          : r
      ),
    }))
  },
}))
