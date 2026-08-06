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
  sociedad_id:      string
  nombre:           string
  fecha_programada: string        // YYYY-MM-DD
  estado:           EstadoTrabajoSanitario
  tratamiento:      string | null
  observaciones:    string | null
  fecha_realizado:  string | null
  creado_por:       string
  created_at:       string
  updated_at:       string
  // agregado en el cliente
  caballos?:        TrabajoSanitarioCaballo[]
}

export interface NuevoTrabajoSanitarioPayload {
  /** Se omite al crear un plan nuevo: lo asigna `sanidadService.crearTrabajos`. */
  plan_id?:         string
  sociedad_id:      string
  nombre:           string
  fecha_programada: string
  tratamiento:      string | null
  observaciones:    string | null
  creado_por:       string
}
