// =============================================================================
// Tipos del módulo Centro de Embriones
// Las entidades animales (donante/receptora/padrillo) referencian
// la tabla `caballo` existente mediante caballo_id (UUID).
// =============================================================================

// ---------------------------------------------------------------------------
// Chips / opciones de ovarios y útero
// ---------------------------------------------------------------------------

export const CHIPS_OI_OD = ['Chico', 'Mediano', 'CLV', '25', '30', '35', '40', '45', 'OV'] as const
export const CHIPS_UTERO = ['C/T', 'Ed-1', 'Ed-2', 'Ed-3', 'Liq+', 'Liq++', 'Liq+++'] as const
export const CHIPS_OBS   = [
  'Strelin', 'IN', 'OXI', 'PG', '1PG', 'Flushing', 'Revisar mañana', 'Transferida',
] as const

export type ChipOvario = typeof CHIPS_OI_OD[number]
export type ChipUtero  = typeof CHIPS_UTERO[number]
export type ChipObs    = typeof CHIPS_OBS[number]

// ---------------------------------------------------------------------------
// Rol reproductivo (columna en caballo)
// ---------------------------------------------------------------------------

export type RolReproductivo = 'Donante' | 'Receptora' | null

// ---------------------------------------------------------------------------
// Estado reproductivo — máquina de estados del flujo reproductivo
// ---------------------------------------------------------------------------

export type EstadoReproductivoDonante =
  | 'revision' | 'strelling' | 'inseminacion' | 'oxy' | 'ov' | 'flushing' | 'pg' | 'espera'

export type EstadoReproductivoReceptora =
  | 'revision' | 'ov' | 'disponible' | 'transferida' | 'eco1' | 'eco2' | 'eco3' | 'prenada' | 'vacia'

export type EstadoReproductivo = EstadoReproductivoDonante | EstadoReproductivoReceptora | null

// Pasos ordenados por flujo
export const PASOS_DONANTE: EstadoReproductivoDonante[] = [
  'revision', 'strelling', 'inseminacion', 'oxy', 'ov', 'flushing', 'pg', 'espera',
]

export const PASOS_RECEPTORA: EstadoReproductivoReceptora[] = [
  'revision', 'ov', 'disponible', 'transferida', 'eco1', 'eco2', 'eco3', 'prenada',
]

// Labels para mostrar en UI
export const LABEL_ESTADO: Record<string, string> = {
  revision:     'Revisión',
  strelling:    'Strelling',
  inseminacion: 'Inseminación',
  oxy:          'Oxy',
  ov:           'OV',
  flushing:     'Flushing',
  pg:           'PG',
  espera:       'Espera',
  disponible:   'Disponible',
  transferida:  'Transferida',
  eco1:         'Eco 1',
  eco2:         'Eco 2',
  eco3:         'Eco 3',
  prenada:      'Preñada',
  vacia:        'Vacía',
}

// ---------------------------------------------------------------------------
// Registro clínico reproductivo
// ---------------------------------------------------------------------------

export interface RegistroClinicoCria {
  id:                string
  caballo_id:        string
  sociedad_id:       string
  fecha:             string          // YYYY-MM-DD
  veterinario_id:    string
  ovario_izq:        string[]
  ovario_der:        string[]
  utero:             string[]
  obs_chips:         string[]
  padrillo_id:       string | null
  ov_dias:           number | null
  review_manana:     boolean
  review_manana_desc: string | null
  motivo:            string | null
  diagnostico:       string | null
  tratamiento:       string | null
  observaciones:     string | null
  created_at:        string
  updated_at:        string
  // joins opcionales
  caballo?:          { nombre: string; rol_reproductivo: RolReproductivo }
  veterinario?:      { nombre: string; apellido: string }
  padrillo?:         { nombre: string } | null
}

export type NuevoRegistroCriaPayload = Omit<
  RegistroClinicoCria,
  'id' | 'created_at' | 'updated_at' | 'caballo' | 'veterinario' | 'padrillo'
>

// ---------------------------------------------------------------------------
// Recordatorio reproductivo
// ---------------------------------------------------------------------------

export type EstadoRecordatorio = 'pendiente' | 'vencido' | 'hecho' | 'cancelado'

export type TipoRecordatorio =
  | 'IN'
  | 'OXI'
  | 'Flushing'
  | 'Dar PG'
  | 'Revisión Strelin'
  | 'Revisión PG'
  | 'Revisión Flushing'
  | 'Revisión'

export interface RecordatorioCria {
  id:                  string
  caballo_id:          string
  sociedad_id:         string
  tipo:                TipoRecordatorio | string
  fecha_vto:           string          // YYYY-MM-DD
  estado:              EstadoRecordatorio
  veterinario_id:      string | null
  notas:               string | null
  auto_generado:       boolean
  origen_registro_id:  string | null
  cancel_motivo:       string | null
  created_at:          string
  updated_at:          string
  // joins opcionales
  caballo?:            { nombre: string; rol_reproductivo: RolReproductivo }
}

export type NuevoRecordatorioPayload = Omit<
  RecordatorioCria,
  'id' | 'created_at' | 'updated_at' | 'caballo'
>

// ---------------------------------------------------------------------------
// Flushing
// ---------------------------------------------------------------------------

export interface Flushing {
  id:                      string
  caballo_id:              string          // donante
  sociedad_id:             string
  fecha:                   string
  veterinario_id:          string
  es_negativo:             boolean
  cantidad:                number | null
  padrillo_id:             string | null
  origen_recordatorio_id:  string | null
  pg_given:                boolean
  cancelado:               boolean
  notas:                   string | null
  created_at:              string
  updated_at:              string
  // joins opcionales
  caballo?:                { nombre: string }
  padrillo?:               { nombre: string } | null
  veterinario?:            { nombre: string; apellido: string }
}

export type NuevoFlushingPayload = Omit<
  Flushing,
  'id' | 'created_at' | 'updated_at' | 'caballo' | 'padrillo' | 'veterinario'
>

// ---------------------------------------------------------------------------
// Embrión (originado en un flushing)
// ---------------------------------------------------------------------------

export type EstadoEmbrion = 'disponible' | 'transferido' | 'descartado' | 'congelado'

export interface Embrion {
  id:                 string
  flushing_id:        string
  caballo_donante_id: string
  sociedad_id:        string
  padrillo_id:        string | null
  estadio:            string | null
  grado:              1 | 2 | 3 | 4 | null
  tamanio:            string | null
  zona_pelucida:      string | null
  estado:             EstadoEmbrion
  notas:              string | null
  created_at:         string
  updated_at:         string
  // joins opcionales
  donante?:           { nombre: string }
  padrillo?:          { nombre: string } | null
}

export type NuevoEmbrionPayload = Omit<
  Embrion,
  'id' | 'created_at' | 'updated_at' | 'donante' | 'padrillo'
>

// ---------------------------------------------------------------------------
// Transferencia embrionaria
// ---------------------------------------------------------------------------

export interface TransferenciaEmbrionaria {
  id:                   string
  sociedad_id:          string
  fecha:                string
  veterinario_id:       string
  registro_id:          string          // cria_registro_clinico de la receptora ese día
  caballo_receptora_id: string
  caballo_donante_id:   string
  padrillo_id:          string | null
  flushing_id:          string | null
  embrion_id:           string | null
  cl_calidad:           string | null
  tono_uterino:         string | null
  tono_cervical:        string | null
  clasificacion:        'Fresco' | 'Congelado' | null
  notas:                string | null
  created_at:           string
  updated_at:           string
  // joins opcionales
  receptora?:           { nombre: string }
  donante?:             { nombre: string }
  padrillo?:            { nombre: string } | null
  veterinario?:         { nombre: string; apellido: string }
  embrion?:             { estadio: string | null; grado: number | null } | null
}

export type NuevaTransferenciaPayload = Omit<
  TransferenciaEmbrionaria,
  'id' | 'created_at' | 'updated_at' | 'receptora' | 'donante' | 'padrillo' | 'veterinario' | 'embrion'
>

// ---------------------------------------------------------------------------
// Vista unificada de caballo con datos reproductivos (para listas del módulo)
// ---------------------------------------------------------------------------

export interface CaballoReproductivo {
  id:                  string
  nombre:              string
  fecha_nacimiento:    string | null
  categoria:           string
  rol_reproductivo:    RolReproductivo
  raza:                string | null
  pelaje:              string | null
  campo:               string | null
  marca:               string | null
  sociedad_id:         string
  activo:              boolean
  // Estado reproductivo actual (calculado en el store)
  ultimo_registro?:    RegistroClinicoCria | null
  recordatorios_hoy?:  RecordatorioCria[]
  dias_post_ov?:       number | null     // null = no hay OV reciente
}
