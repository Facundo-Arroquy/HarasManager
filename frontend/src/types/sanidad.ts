// =============================================================================
// Tipos del módulo de Sanidad — trabajos sanitarios multi-caballo
// (migración 20260728181738). Un "trabajo" (ej: desparasitar) se arma como una
// lista de caballos programada para un día; al completarlo se escribe una fila
// en el historial clínico de cada caballo no excluido.
// =============================================================================

export interface CatTrabajoSanitario {
  id:          string
  sociedad_id: string | null   // null = trabajo global (pre-cargado)
  nombre:      string
  activo:      boolean
}

export type EstadoTrabajoSanitario = 'pendiente' | 'realizado' | 'cancelado'

export const LABEL_ESTADO_TRABAJO: Record<EstadoTrabajoSanitario, string> = {
  pendiente: 'Pendiente',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
}

/** Resultado por caballo y trabajo. `null` = todavía sin marcar. */
export type EstadoCaballoTrabajo = 'realizado' | 'no_realizado' | 'pendiente'

export const LABEL_ESTADO_CABALLO: Record<EstadoCaballoTrabajo, string> = {
  realizado:    'Realizado',
  no_realizado: 'No realizado',
  pendiente:    'Pendiente',
}

export interface TrabajoSanitarioCaballo {
  id:           string
  trabajo_id:   string
  caballo_id:   string
  excluido:     boolean
  estado:       EstadoCaballoTrabajo | null
  historial_id: string | null
  // join opcional
  caballo?:     { nombre: string; numero_registro?: string | null }
}

export interface TrabajoSanitario {
  id:               string
  /** Agrupa los trabajos cargados juntos: son las columnas de una misma grilla. */
  plan_id:          string
  /** `null` cuando el plan es sobre los caballos propios de un veterinario. */
  sociedad_id:      string | null
  /** Veterinario dueño del plan. Excluyente con `sociedad_id`. */
  vet_owner_id:     string | null
  nombre:           string
  fecha_programada: string        // YYYY-MM-DD
  estado:           EstadoTrabajoSanitario
  tratamiento:      string | null
  observaciones:    string | null
  fecha_realizado:  string | null
  creado_por:       string
  /** Veterinario con el que se compartió: lo ve en su panel y puede cerrarlo. */
  compartido_con:   string | null
  created_at:       string
  updated_at:       string
  // joins opcionales
  caballos?:        TrabajoSanitarioCaballo[]
  /**
   * Solo viaja en `listarTrabajos` (el lado de la empresa): un veterinario no
   * puede leer la fila de `usuario` de un admin, así que en su listado el
   * origen se resuelve por empresa.
   */
  creador?:         { nombre: string; apellido: string; rol: string | null } | null
}

/** Caballo del plan al que el veterinario elegido todavía no tiene acceso. */
export interface CaballoSinAcceso {
  caballo_id: string
  nombre:     string
}

/** Un trabajo a crear, tal como lo espera `crear_plan_sanitario_compartido`. */
export interface ItemPlanSanitario {
  /** `null` = plan sobre los caballos propios del veterinario. */
  sociedad_id:      string | null
  nombre:           string
  fecha_programada: string
  tratamiento:      string | null
  observaciones:    string | null
  caballo_ids:      string[]
}

export interface NuevoTrabajoSanitarioPayload {
  /** Se omite al crear un plan nuevo: lo asigna `sanidadService.crearTrabajos`. */
  plan_id?:         string
  sociedad_id:      string | null
  vet_owner_id?:    string | null
  nombre:           string
  fecha_programada: string
  tratamiento:      string | null
  observaciones:    string | null
  creado_por:       string
  /** Se arrastra al reprogramar pendientes: el vet asignado sigue siéndolo. */
  compartido_con?:  string | null
}
