// =============================================================================
// Tipos del módulo de Torneos — migración 20260803120000
// =============================================================================
// Un torneo es una competencia de la sociedad, con una lista de jugadores
// participantes. Los caballos con tag "Jugador" se reparten entre esos
// jugadores en un tablero kanban; el reparto queda como historial de
// conformación de equipos.
// =============================================================================

export type EstadoTorneo = 'activo' | 'finalizado' | 'cancelado'

export const LABEL_ESTADO_TORNEO: Record<EstadoTorneo, string> = {
  activo:     'Activo',
  finalizado: 'Finalizado',
  cancelado:  'Cancelado',
}

export interface Torneo {
  id:           string
  sociedad_id:  string
  nombre:       string
  temporada:    string | null
  fecha_inicio: string | null      // YYYY-MM-DD
  fecha_fin:    string | null
  estado:       EstadoTorneo
  notas:        string | null
  creado_por:   string | null
  created_at:   string
  updated_at:   string
  // agregados en el cliente
  jugadores?:   TorneoJugador[]
  cantidad_jugadores?: number
  cantidad_asignados?: number
}

/**
 * Una columna del kanban. `usuario_id` es opcional a propósito: en polo el
 * jugador no necesariamente tiene usuario en la plataforma, pero cuando lo
 * tiene queremos poder cruzarlo.
 */
export interface TorneoJugador {
  id:         string
  torneo_id:  string
  usuario_id: string | null
  nombre:     string
  orden:      number
  created_at: string
}

/** Caballo tal como se muestra en una tarjeta del tablero. */
export interface CaballoTorneo {
  id:              string
  nombre:          string
  numero_registro: string | null
  categoria:       string | null
  pelaje:          string | null
  campo:           string | null
}

export interface TorneoAsignacion {
  id:         string
  torneo_id:  string
  jugador_id: string
  caballo_id: string
  orden:      number
}

/** Estado completo del tablero: disponibles + una lista por jugador. */
export interface TableroTorneo {
  torneo:      Torneo
  jugadores:   TorneoJugador[]
  disponibles: CaballoTorneo[]
  /** jugador_id → caballos en el orden asignado */
  porJugador:  Record<string, CaballoTorneo[]>
}

export interface NuevoTorneoPayload {
  sociedad_id:  string
  nombre:       string
  temporada:    string | null
  fecha_inicio: string | null
  fecha_fin:    string | null
  notas:        string | null
  /** Nombres de los jugadores participantes, en el orden de las columnas. */
  jugadores:    NuevoJugadorPayload[]
}

export interface NuevoJugadorPayload {
  nombre:      string
  usuario_id?: string | null
}

/** Columna del tablero que no corresponde a un jugador. */
export const COLUMNA_DISPONIBLES = 'disponibles'
