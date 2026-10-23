import { create } from 'zustand'
import { crianzaService } from '../services/crianzaService'
import { useAuthStore } from './authStore'
import { mensajeError } from '../utils/error'
import { hoyAR } from '../utils/fecha'
import { actoResuelveRecordatorio, type ActoCria } from '../utils/recordatorio'
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
  NuevoFlushingPayload,
  EstadoRecordatorio,
  TipoRecordatorio,
  RolReproductivo,
  ReglaRecordatorioVet,
  ConfiguracionCriaEfectiva,
} from '../types/crianza'
import { plazosDesdeConfiguracion } from '../types/crianza'

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
//   OV (inseminada)     → Flushing  +6 días
//   OV (sin inseminar)  → Dar PG    +4 días
//   1PG     → Revisión 1PG  +N días (elegidos por el vet)
//   PG      → Revisión PG   +3 días
//   Flushing→ Rev.Flushing +4 días
//
// Receptora:
//   Strelin → Revisión Strelin  próximo MWF
//   1PG     → Revisión 1PG      +N días (elegidos por el vet)
//   PG      → Revisión PG       +4 días
//   OV (sin Transferida) → Dar PG  +3 días
//
// Cualquiera:
//   review_dias = N → Revisión  fecha + N días (1..60, migración 20260917174756;
//                      reemplaza al viejo checkbox fijo al próximo MWF)
//
// Además, las reglas propias de cada vet (tabla cria_regla_recordatorio): si
// marca la acción X, se pide la acción Y a los Z días. Si una repite un tipo
// que ya genera una regla fija, gana la fija y no se agenda dos veces.
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

export interface ReglaRecordatorio {
  tipo: TipoRecordatorio | string
  calcularFecha: (fecha: string) => string
}

/**
 * Días hacia atrás (desde la fecha del registro, inclusive) en los que una IN
 * cuenta como "inseminada antes de esta ovulación". Cubre la IN del ciclo
 * (1–2 días antes de ovular) y los re-registros de OV con días post-OV, sin
 * alcanzar la IN del ciclo anterior (12+ días antes).
 *
 * @deprecated La fuente de verdad es la RPC `registrar_acto_reproductivo` en
 * PostgreSQL (campo `ventana_inseminacion_dias` de `get_configuracion_cria_efectiva`).
 * Este valor solo se conserva para el preview del modal y la consulta de
 * inseminación reciente del frontend. No modificarlo sin actualizar la RPC.
 */
export const VENTANA_INSEMINACION_DIAS = 7

/**
 * Recordatorios que genera un registro. La usa el store al guardar y el preview
 * de RegistroCriaModal, para que lo que se muestra sea lo que se crea.
 */
/** @deprecated Solo preview. La generación real vive en registrar_acto_reproductivo. */
export function reglasParaRegistro(
  registro: Pick<NuevoRegistroCriaPayload,
    'fecha' | 'obs_chips' | 'ovario_izq' | 'ovario_der' | 'review_dias' | 'fecha_flushing_programada'>,
  rolReproductivo: RolReproductivo,
  cfg: PlazosVet,
  /** Hubo IN en este registro o en los VENTANA_INSEMINACION_DIAS previos. */
  inseminada: boolean,
  propias: ReglaRecordatorioVet[] = [],
  /** Días custom elegidos por el vet para la revisión de 1° PG. */
  diasRevision1PG?: number | null,
): ReglaRecordatorio[] {
  const chips = registro.obs_chips
  const reglas: ReglaRecordatorio[] = []
  const base = registro.fecha

  if (rolReproductivo === 'Donante') {
    if (chips.includes('Strelin') && !chips.includes('IN'))
      reglas.push({ tipo: 'IN', calcularFecha: (f) => sumarDias(f, cfg.donante_strelin_a_in) })
    if (chips.includes('IN'))
      reglas.push({ tipo: 'OXI', calcularFecha: (f) => sumarDias(f, cfg.donante_in_a_oxi) })
    if (chips.includes('OXI'))
      reglas.push({ tipo: 'Revisión', calcularFecha: (f) => sumarDias(f, 1) })
    // Solo por el estado ovárico, igual que el preview de RegistroCriaModal:
    // 'OV' no es un obs_chip (es un chip de ovario), así que chequearlo en
    // `chips` era condición muerta y además divergía del preview.
    // Sin IN previa no hay embrión que lavar: en vez de Flushing se agenda
    // Dar PG para cortar el ciclo (pedido de Facu, 2026-09-12).
    if (registro.ovario_izq.includes('OV') || registro.ovario_der.includes('OV'))
      reglas.push(inseminada
        ? { tipo: 'Flushing', calcularFecha: (f) => registro.fecha_flushing_programada ?? sumarDias(f, cfg.donante_ov_a_flushing) }
        : { tipo: 'Dar PG',   calcularFecha: (f) => sumarDias(f, cfg.donante_ov_sin_in_a_dar_pg) })
    // 1PG: días custom elegidos por el vet → "Revisión 1PG"
    if (chips.includes('1PG') && diasRevision1PG)
      reglas.push({ tipo: 'Revisión 1PG', calcularFecha: (f) => sumarDias(f, diasRevision1PG) })
    // PG: plazo configurado → "Revisión PG" (sin cambios)
    if (chips.includes('PG'))
      reglas.push({ tipo: 'Revisión PG', calcularFecha: (f) => sumarDias(f, cfg.donante_pg_a_revision_pg) })
    if (chips.includes('Flushing'))
      reglas.push({ tipo: 'Revisión Flushing', calcularFecha: (f) => sumarDias(f, cfg.donante_flushing_a_revision) })
  }

  if (rolReproductivo === 'Receptora') {
    if (chips.includes('Strelin'))
      reglas.push({ tipo: 'Revisión Strelin', calcularFecha: (f) => proximoMWF(f) })
    // 1PG: días custom elegidos por el vet → "Revisión 1PG"
    if (chips.includes('1PG') && diasRevision1PG)
      reglas.push({ tipo: 'Revisión 1PG', calcularFecha: (f) => sumarDias(f, diasRevision1PG) })
    // PG: plazo configurado → "Revisión PG" (sin cambios)
    if (chips.includes('PG'))
      reglas.push({ tipo: 'Revisión PG', calcularFecha: (f) => sumarDias(f, cfg.receptora_pg_a_revision_pg) })
    const tieneOV = registro.ovario_izq.includes('OV') || registro.ovario_der.includes('OV')
    const fueTransferida = chips.includes('Transferida')
    if (tieneOV && !fueTransferida)
      reglas.push({ tipo: 'Dar PG', calcularFecha: (f) => sumarDias(f, cfg.receptora_ov_a_dar_pg) })
  }

  for (const p of propias) {
    const aplica = p.rol === 'Ambas' || p.rol === rolReproductivo
    if (!aplica || !chips.includes(p.accion_disparadora)) continue
    if (reglas.some((r) => r.tipo === p.accion_recordatorio)) continue
    reglas.push({ tipo: p.accion_recordatorio, calcularFecha: (f) => sumarDias(f, p.dias) })
  }

  // Igual que registrar_acto_reproductivo: si OXI ya agendó una Revisión (+1 día),
  // los días de revisión del registro no agendan una segunda.
  if (registro.review_dias && !reglas.some((r) => r.tipo === 'Revisión'))
    reglas.push({ tipo: 'Revisión', calcularFecha: (f) => sumarDias(f, registro.review_dias!) })

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
  configuracion:  ConfiguracionCriaEfectiva | null
  /** Reglas propias del vet autenticado, que se suman a las fijas. */
  reglasPropias:  ReglaRecordatorioVet[]
  loading:        boolean
  error:          string | null

  cargar: (sociedadId: string) => Promise<void>
  cargarParaVet: () => Promise<void>

  /** Recarga los plazos y las reglas propias del vet (tras cambiarlos en configuración). */
  cargarPlazos: () => Promise<void>
  guardarPlazos: (veterinarioId: string, plazos: PlazosVet) => Promise<void>

  // Registros clínicos
  crearRegistro: (
    payload: NuevoRegistroCriaPayload,
    rolReproductivo: RolReproductivo,
    ajustesFinDeSemana?: Record<string, number>,
    diasRevision1PG?: number | null,
  ) => Promise<RegistroClinicoCria>

  /**
   * Si la yegua tuvo una IN en los VENTANA_INSEMINACION_DIAS previos a `fecha`
   * (inclusive). Decide si la OV de la donante agenda Flushing o Dar PG.
   */
  consultarInseminacionReciente: (caballoId: string, fecha: string) => Promise<boolean>

  // Recordatorios
  actualizarEstadoRecordatorio: (
    id: string,
    estado: EstadoRecordatorio,
    cancelMotivo?: string
  ) => Promise<void>

  /** Corre el vencimiento un día (o los que se pidan) y lo deja pendiente. */
  posponerRecordatorio: (id: string, dias?: number, motivo?: string) => Promise<void>

  /** Pospone a una fecha específica elegida por el vet. */
  posponerRecordatorioAFecha: (id: string, nuevaFecha: string, motivo?: string) => Promise<void>

  /**
   * Marca `hecho` los recordatorios abiertos del animal para ese día que el acto
   * recién cargado resuelve (ver `actoResuelveRecordatorio`). No falla: lo
   * cargado ya quedó guardado y lo peor que pasa es que el recordatorio siga
   * abierto, como antes.
   */
  cerrarRecordatoriosResueltos: (caballoId: string, fecha: string, acto: ActoCria) => Promise<void>

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
  // Se hidrata desde get_configuracion_cria_efectiva antes de que haya datos
  // reproductivos renderizables. No contiene defaults duplicados en el cliente.
  plazos:         null as unknown as PlazosVet,
  configuracion:  null,
  reglasPropias:  [],
  loading:        false,
  error:          null,

  // ── Carga inicial ──────────────────────────────────────────────────────────

  cargar: async (sociedadId) => {
    set({ loading: true, error: null })
    try {
      const lbl = <T,>(name: string, p: Promise<T>): Promise<T> =>
        p.catch((e: unknown) => { throw new Error(`[${name}] ${mensajeError(e)}`) }) as Promise<T>
      const vetId = useAuthStore.getState().user?.id
      if (!vetId) throw new Error('No se pudo identificar al veterinario')
      const [registros, recordatorios, flushings, transferencias, ecografias, configuracion] = await Promise.all([
        lbl('registros',      crianzaService.listarRegistros(sociedadId)),
        lbl('recordatorios',  crianzaService.listarRecordatorios(sociedadId)),
        lbl('flushings',      crianzaService.listarFlushings(sociedadId)),
        lbl('transferencias', crianzaService.listarTransferencias(sociedadId)),
        lbl('ecografias',     crianzaService.listarEcografias(sociedadId)),
        lbl('plazos',         crianzaService.getConfiguracionEfectiva(vetId)),
      ])
      set({ registros, recordatorios, flushings, transferencias, ecografias,
        configuracion, plazos: plazosDesdeConfiguracion(configuracion) })
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
      const vetId = useAuthStore.getState().user?.id
      if (!vetId) throw new Error('No se pudo identificar al veterinario')
      const [registros, recordatorios, flushings, transferencias, ecografias, configuracion] = await Promise.all([
        crianzaService.listarRegistrosVet(),
        crianzaService.listarRecordatoriosVet(),
        crianzaService.listarFlushingsVet(),
        crianzaService.listarTransferenciasVet(),
        crianzaService.listarEcografiasVet(),
        crianzaService.getConfiguracionEfectiva(vetId),
      ])
      set({ registros, recordatorios, flushings, transferencias, ecografias,
        configuracion, plazos: plazosDesdeConfiguracion(configuracion) })
      get().sincronizarVencidos()
    } catch (err) {
      set({ error: mensajeError(err, 'Error al cargar datos') })
    } finally {
      set({ loading: false })
    }
  },

  // ── Plazos del veterinario ────────────────────────────────────────────────

  cargarPlazos: async () => {
    const vetId = useAuthStore.getState().user?.id
    if (!vetId) throw new Error('No se pudo identificar al veterinario')
    const [configuracion, reglasPropias] = await Promise.all([
      crianzaService.getConfiguracionEfectiva(vetId),
      crianzaService.listarMisReglas(),
    ])
    set({ configuracion, plazos: plazosDesdeConfiguracion(configuracion), reglasPropias })
  },

  guardarPlazos: async (veterinarioId, plazos) => {
    await crianzaService.guardarMisPlazos(veterinarioId, plazos)
    const configuracion = await crianzaService.getConfiguracionEfectiva(veterinarioId)
    set({ configuracion, plazos: plazosDesdeConfiguracion(configuracion) })
  },

  // ── Registros clínicos ────────────────────────────────────────────────────

  crearRegistro: async (payload, rolReproductivo, ajustesFinDeSemana, diasRevision1PG) => {
    if (!rolReproductivo) throw new Error('El acto reproductivo requiere rol de Donante o Receptora')
    const result = await crianzaService.registrarActoReproductivo(
      payload, rolReproductivo, ajustesFinDeSemana, diasRevision1PG,
    )
    const idsActualizados = new Set(result.recordatorios.map((r) => r.id))
    set((s) => ({
      registros: [result.registro, ...s.registros],
      recordatorios: [
        ...result.recordatorios,
        ...s.recordatorios.filter((r) => !idsActualizados.has(r.id)),
      ],
    }))
    return result.registro
  },

  consultarInseminacionReciente: (caballoId, fecha) =>
    crianzaService.huboInseminacionEntre(
      caballoId,
      sumarDias(fecha, -VENTANA_INSEMINACION_DIAS),
      fecha,
    ),

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

  cerrarRecordatoriosResueltos: async (caballoId, fecha, acto) => {
    try {
      const abiertos = await crianzaService.listarRecordatoriosAbiertosDelDia(caballoId, fecha)
      const ids = abiertos
        .filter((r) => actoResuelveRecordatorio(r.tipo, acto))
        .map((r) => r.id)
      if (ids.length === 0) return
      await crianzaService.marcarRecordatoriosHechos(ids)
      set((s) => ({
        recordatorios: s.recordatorios.map((r) =>
          ids.includes(r.id) ? { ...r, estado: 'hecho' as EstadoRecordatorio } : r
        ),
      }))
    } catch (e) {
      console.error('[crianzaStore] cerrar recordatorios resueltos:', mensajeError(e))
    }
  },

  posponerRecordatorio: async (id, dias = 1, motivo) => {
    const actual = get().recordatorios.find((r) => r.id === id)
    if (!actual) return
    const userId = useAuthStore.getState().user?.id
    if (!userId) return
    // Se corre desde hoy, no desde fecha_vto: posponer uno que quedó vencido
    // hace una semana tiene que caer mañana, no el día siguiente al original.
    const base = actual.fecha_vto > hoyAR() ? actual.fecha_vto : hoyAR()
    const nuevaFecha = sumarDias(base, dias)
    const motivoFinal = motivo ?? (dias === 1 ? 'pospuesto_1d' : `pospuesto_${dias}d`)
    await crianzaService.posponerRecordatorio(id, nuevaFecha, motivoFinal, userId)
    set((s) => ({
      recordatorios: s.recordatorios.map((r) =>
        r.id === id
          ? {
              ...r,
              fecha_vto: nuevaFecha,
              estado: 'pendiente' as EstadoRecordatorio,
              fecha_original: r.fecha_original ?? actual.fecha_vto,
            }
          : r
      ),
    }))
  },

  posponerRecordatorioAFecha: async (id, nuevaFecha, motivo) => {
    const actual = get().recordatorios.find((r) => r.id === id)
    if (!actual) return
    const userId = useAuthStore.getState().user?.id
    if (!userId) return
    if (nuevaFecha < hoyAR()) throw new Error('La fecha no puede ser anterior a hoy')
    await crianzaService.posponerRecordatorio(id, nuevaFecha, motivo ?? 'manual', userId)
    set((s) => ({
      recordatorios: s.recordatorios.map((r) =>
        r.id === id
          ? {
              ...r,
              fecha_vto: nuevaFecha,
              estado: 'pendiente' as EstadoRecordatorio,
              fecha_original: r.fecha_original ?? actual.fecha_vto,
            }
          : r
      ),
    }))
  },

  // ── Flushings ─────────────────────────────────────────────────────────────

  crearFlushing: async (payload) => {
    const flushing = await crianzaService.crearFlushing(payload)
    set((s) => ({ flushings: [flushing, ...s.flushings] }))

    // RPC SECURITY DEFINER: cierra TODOS los recordatorios del ciclo anterior
    // de esta donante (excepto Eco, Revisión Eco y lo que cuelga de este flushing).
    try {
      await crianzaService.cerrarRecordatoriosFlushing(payload.caballo_id, flushing.id)
      set((s) => ({
        recordatorios: s.recordatorios.map((r) =>
          r.caballo_id === payload.caballo_id &&
          (r.estado === 'pendiente' || r.estado === 'vencido') &&
          r.auto_generado &&
          !['Eco 1', 'Eco 2', 'Eco 3', 'Revisión Eco'].includes(r.tipo) &&
          r.flushing_id !== flushing.id
            ? { ...r, estado: 'cancelado' as EstadoRecordatorio, cancel_motivo: 'Ciclo cerrado por nuevo flushing' }
            : r
        ),
      }))
    } catch (e) {
      console.error('[crianzaStore] cerrar recordatorios flushing:', mensajeError(e))
    }

    // El trigger trg_cria_flushing_sincronizar_revision_pg crea la "Revisión PG"
    // en la DB pero el frontend no la tiene en memoria. La traemos y la sumamos.
    try {
      const nuevosRec = await crianzaService.listarRecordatoriosPorFlushing(flushing.id)
      if (nuevosRec.length > 0) {
        set((s) => ({
          recordatorios: [...s.recordatorios, ...nuevosRec],
        }))
      }
    } catch (e) {
      console.error('[crianzaStore] traer recordatorios del flushing:', mensajeError(e))
    }

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
    set((s) => ({
      transferencias: [transferencia, ...s.transferencias],
      // La RPC cancela los "Dar PG" pendientes/vencidos de la receptora en la DB.
      // Reflejar lo mismo en memoria para que la UI no los muestre más.
      recordatorios: s.recordatorios.map((r) =>
        r.caballo_id === payload.caballo_receptora_id &&
        r.tipo === 'Dar PG' &&
        (r.estado === 'pendiente' || r.estado === 'vencido')
          ? { ...r, estado: 'cancelado' as EstadoRecordatorio, cancel_motivo: 'Receptora transferida' }
          : r
      ),
    }))
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
