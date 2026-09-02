import { create } from 'zustand'
import { crianzaService } from '../services/crianzaService'
import { useToastStore } from './toastStore'
import { mensajeError } from '../utils/error'
import { hoyAR } from '../utils/fecha'
import { PLAZOS_VET_DEFAULTS } from '../types/crianza'
import type {
  PlazosVet,
  RegistroClinicoCria,
  RecordatorioCria,
  Flushing,
  TransferenciaEmbrionaria,
  RegistrarTransferenciaPayload,
  Ecografia,
  NuevaEcografiaPayload,
  NuevoRegistroCriaPayload,
  NuevoRecordatorioPayload,
  NuevoFlushingPayload,
  EstadoRecordatorio,
  TipoRecordatorio,
  RolReproductivo,
} from '../types/crianza'

// =============================================================================
// Auto-generación de recordatorios según chips seleccionados
//
// Tabla de reglas (fuente: lógica de negocio EquiVet). Los días son los plazos
// del veterinario que hace el registro (tabla cria_plazo_vet, cargados en el
// store) — definición de Gero: "debe cumplir el plazo del vet que hace el
// registro". Los valores entre paréntesis son los defaults.
//
// Donante:
//   Strelin → IN           +1 día
//   IN      → OXI          +1 día
//   OV      → Flushing     +6 días
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

/**
 * Próximo lunes / miércoles / viernes posterior a `fecha` ('YYYY-MM-DD').
 *
 * Se ancla al mediodía UTC y avanza con los getters/setters UTC: mezclar el
 * parseo UTC de 'YYYY-MM-DD' con `getDay()`/`setDate()` locales corría el
 * cálculo un día en cualquier zona con offset negativo (Argentina incluida) y
 * el resultado ni siquiera caía en lunes/miércoles/viernes.
 * Es la misma implementación que usa el preview de RegistroCriaModal.
 */
function proximoMWF(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  // 1=Lun 3=Mié 5=Vie
  while (![1, 3, 5].includes(d.getUTCDay())) {
    d.setUTCDate(d.getUTCDate() + 1)
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
  rolReproductivo: RolReproductivo,
  cfg: PlazosVet
): ReglaRecordatorio[] {
  const chips = registro.obs_chips
  const reglas: ReglaRecordatorio[] = []
  const base = registro.fecha

  if (rolReproductivo === 'Donante') {
    if (chips.includes('Strelin'))
      reglas.push({ tipo: 'IN', calcularFecha: (f) => sumarDias(f, cfg.donante_strelin_a_in) })
    if (chips.includes('IN'))
      reglas.push({ tipo: 'OXI', calcularFecha: (f) => sumarDias(f, cfg.donante_in_a_oxi) })
    // Solo por el estado ovárico, igual que el preview de RegistroCriaModal:
    // 'OV' no es un obs_chip (es un chip de ovario), así que chequearlo en
    // `chips` era condición muerta y además divergía del preview.
    if (registro.ovario_izq.includes('OV') || registro.ovario_der.includes('OV'))
      reglas.push({ tipo: 'Flushing', calcularFecha: (f) => sumarDias(f, cfg.donante_ov_a_flushing) })
    if (chips.includes('PG'))
      reglas.push({ tipo: 'Revisión PG', calcularFecha: (f) => sumarDias(f, cfg.donante_pg_a_revision_pg) })
    if (chips.includes('Flushing'))
      reglas.push({ tipo: 'Revisión Flushing', calcularFecha: (f) => sumarDias(f, cfg.donante_flushing_a_revision) })
  }

  if (rolReproductivo === 'Receptora') {
    if (chips.includes('Strelin'))
      reglas.push({ tipo: 'Revisión Strelin', calcularFecha: (f) => proximoMWF(f) })
    if (chips.includes('PG'))
      reglas.push({ tipo: 'Revisión PG', calcularFecha: (f) => sumarDias(f, cfg.receptora_pg_a_revision_pg) })
    const tieneOV = registro.ovario_izq.includes('OV') || registro.ovario_der.includes('OV')
    const fueTransferida = chips.includes('Transferida')
    if (tieneOV && !fueTransferida)
      reglas.push({ tipo: 'Dar PG', calcularFecha: (f) => sumarDias(f, cfg.receptora_ov_a_dar_pg) })
  }

  if (registro.review_manana)
    reglas.push({ tipo: 'Revisión', calcularFecha: (f) => proximoMWF(f) })

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
  ecografias:     Ecografia[]
  /** Plazos del vet autenticado. Los usa reglasParaRegistro al crear recordatorios. */
  plazos:         PlazosVet
  loading:        boolean
  error:          string | null

  cargar: (sociedadId: string) => Promise<void>
  cargarParaVet: () => Promise<void>

  /** Recarga los plazos del vet (tras guardarlos en configuración). */
  cargarPlazos: () => Promise<void>
  guardarPlazos: (veterinarioId: string, plazos: PlazosVet) => Promise<void>

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

  /** Corre el vencimiento un día (o los que se pidan) y lo deja pendiente. */
  posponerRecordatorio: (id: string, dias?: number) => Promise<void>

  // Flushings
  crearFlushing: (payload: NuevoFlushingPayload) => Promise<Flushing>
  actualizarFlushing: (id: string, payload: Partial<NuevoFlushingPayload>) => Promise<void>

  // Transferencias
  /** Transferencia completa en una sola transacción (RPC). Ver crianzaService. */
  registrarTransferencia: (payload: RegistrarTransferenciaPayload) => Promise<TransferenciaEmbrionaria>

  // Ecografías
  /** Registra una ecografía y sincroniza el estado reproductivo de la receptora. */
  registrarEcografia: (payload: NuevaEcografiaPayload) => Promise<Ecografia>

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
  ecografias:     [],
  plazos:         PLAZOS_VET_DEFAULTS,
  loading:        false,
  error:          null,

  // ── Carga inicial ──────────────────────────────────────────────────────────

  cargar: async (sociedadId) => {
    set({ loading: true, error: null })
    try {
      const lbl = <T,>(name: string, p: Promise<T>): Promise<T> =>
        p.catch((e: unknown) => { throw new Error(`[${name}] ${mensajeError(e)}`) }) as Promise<T>
      const [registros, recordatorios, flushings, transferencias, ecografias, plazos] = await Promise.all([
        lbl('registros',      crianzaService.listarRegistros(sociedadId)),
        lbl('recordatorios',  crianzaService.listarRecordatorios(sociedadId)),
        lbl('flushings',      crianzaService.listarFlushings(sociedadId)),
        lbl('transferencias', crianzaService.listarTransferencias(sociedadId)),
        lbl('ecografias',     crianzaService.listarEcografias(sociedadId)),
        lbl('plazos',         crianzaService.getMisPlazos()),
      ])
      set({ registros, recordatorios, flushings, transferencias, ecografias, plazos })
      get().sincronizarVencidos()
    } catch (err) {
      set({ error: mensajeError(err, 'Error al cargar datos') })
    } finally {
      set({ loading: false })
    }
  },

  cargarParaVet: async () => {
    set({ loading: true, error: null })
    try {
      const [registros, recordatorios, flushings, transferencias, ecografias, plazos] = await Promise.all([
        crianzaService.listarRegistrosVet(),
        crianzaService.listarRecordatoriosVet(),
        crianzaService.listarFlushingsVet(),
        crianzaService.listarTransferenciasVet(),
        crianzaService.listarEcografiasVet(),
        crianzaService.getMisPlazos(),
      ])
      set({ registros, recordatorios, flushings, transferencias, ecografias, plazos })
      get().sincronizarVencidos()
    } catch (err) {
      set({ error: mensajeError(err, 'Error al cargar datos') })
    } finally {
      set({ loading: false })
    }
  },

  // ── Plazos del veterinario ────────────────────────────────────────────────

  cargarPlazos: async () => {
    const plazos = await crianzaService.getMisPlazos()
    set({ plazos })
  },

  guardarPlazos: async (veterinarioId, plazos) => {
    await crianzaService.guardarMisPlazos(veterinarioId, plazos)
    set({ plazos })
  },

  // ── Registros clínicos ────────────────────────────────────────────────────

  crearRegistro: async (payload, rolReproductivo) => {
    const registro = await crianzaService.crearRegistro(payload)
    set((s) => ({ registros: [registro, ...s.registros] }))

    // Auto-generar recordatorios según chips (insert batch para evitar N+1).
    // Los plazos son los del vet autenticado = el que hace el registro.
    const reglas = reglasParaRegistro(payload, rolReproductivo, get().plazos)
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
      try {
        const recs = await crianzaService.crearRecordatoriosBatch(recPayloads)
        set((s) => ({ recordatorios: [...s.recordatorios, ...recs] }))
      } catch (e) {
        // El registro clínico ya quedó guardado. Si además propagáramos este
        // error, el modal lo mostraría como fallo y el vet volvería a guardar,
        // duplicando el registro y —al reintento exitoso— sus recordatorios.
        // Se avisa y se sigue: los recordatorios se pueden cargar a mano.
        useToastStore.getState().pushToast(
          'error',
          'El registro se guardó, pero no se pudieron generar los recordatorios automáticos. ' +
            'Cargalos a mano desde el programa semanal.',
        )
        console.error('[crianzaStore] recordatorios automáticos:', mensajeError(e))
      }
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

  posponerRecordatorio: async (id, dias = 1) => {
    const actual = get().recordatorios.find((r) => r.id === id)
    if (!actual) return
    // Se corre desde hoy, no desde fecha_vto: posponer uno que quedó vencido
    // hace una semana tiene que caer mañana, no el día siguiente al original.
    const base = actual.fecha_vto > hoyAR() ? actual.fecha_vto : hoyAR()
    const nuevaFecha = sumarDias(base, dias)
    await crianzaService.posponerRecordatorio(id, nuevaFecha)
    set((s) => ({
      recordatorios: s.recordatorios.map((r) =>
        r.id === id
          ? { ...r, fecha_vto: nuevaFecha, estado: 'pendiente' as EstadoRecordatorio }
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

  registrarTransferencia: async (payload) => {
    const transferencia = await crianzaService.registrarTransferenciaEmbrionaria(payload)
    set((s) => ({ transferencias: [transferencia, ...s.transferencias] }))
    return transferencia
  },

  // ── Ecografías ────────────────────────────────────────────────────────────

  registrarEcografia: async (payload) => {
    const ecografia = await crianzaService.registrarEcografia(payload)
    set((s) => ({ ecografias: [ecografia, ...s.ecografias] }))
    return ecografia
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
    // La fecha tiene que ser la de Argentina: con `toISOString()` (UTC) los
    // recordatorios del día se marcaban vencidos —y se persistía el estado— a
    // partir de las 21:00 hora local.
    const hoy = hoyAR()
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
