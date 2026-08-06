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

// ---------------------------------------------------------------------------
// Catálogo editable de acciones/tratamientos (antes CHIPS_OBS hardcodeado)
// Migración 20260730120000 — cat_chip_obs, una lista por veterinario.
// Definición de Gero: la lista la define cada vet y viaja con él a todos los
// establecimientos donde trabaja.
// ---------------------------------------------------------------------------

export interface CatChipObs {
  id:             string
  veterinario_id: string
  nombre:         string
  activo:         boolean
}

export type NuevoCatChipObsPayload = Pick<CatChipObs, 'veterinario_id' | 'nombre'>

/**
 * Chips que `reglasParaRegistro` (crianzaStore) interpreta para generar
 * recordatorios automáticos. No están protegidos —el vet puede sacarlos— pero
 * la UI los marca para que sea una decisión informada: sin el chip no hay
 * recordatorio.
 *
 * Vive acá y no en la DB para que sea una sola fuente de verdad junto a las
 * reglas que los leen.
 */
export const CHIPS_CON_RECORDATORIO = [
  'Strelin', 'IN', 'OV', 'PG', 'Flushing', 'Transferida',
] as const

/** Sugerencias para el vet que arranca con la lista vacía. */
export const CHIPS_OBS_SUGERIDOS = [
  'Strelin', 'IN', 'OXI', 'PG', '1PG', 'Flushing', 'Revisar mañana', 'Transferida',
] as const

// ---------------------------------------------------------------------------
// Plazos de recordatorios, por veterinario (migración 20260730120000)
// Antes vivían en localStorage → el plazo aplicado era el del navegador y no
// el del vet, incumpliendo "debe cumplir el plazo del vet que hace el registro".
// ---------------------------------------------------------------------------

export interface PlazosVet {
  donante_strelin_a_in:        number
  donante_in_a_oxi:            number
  donante_ov_a_flushing:       number
  donante_pg_a_revision_pg:    number
  donante_flushing_a_revision: number
  receptora_pg_a_revision_pg:  number
  receptora_ov_a_dar_pg:       number
}

export const PLAZOS_VET_DEFAULTS: PlazosVet = {
  donante_strelin_a_in:        1,
  donante_in_a_oxi:            1,
  donante_ov_a_flushing:       6,
  donante_pg_a_revision_pg:    3,
  donante_flushing_a_revision: 4,
  receptora_pg_a_revision_pg:  4,
  receptora_ov_a_dar_pg:       3,
}

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

/**
 * Embrión con su transferencia (si la tuvo) y las ecografías de esa
 * transferencia. Los embriones que nunca se transfirieron vienen con
 * `cria_transferencia` vacío: en la lista se muestran sin receptora.
 */
export interface EmbrionConSeguimiento extends Embrion {
  cria_transferencia?: Array<{
    fecha:      string
    receptora:  { nombre: string; pelaje: { nombre: string } | null } | null
    cria_ecografia: Array<{
      numero:    number
      fecha:     string
      resultado: ResultadoEcografia
    }>
  }>
}

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

/**
 * Payload de la RPC `registrar_transferencia_embrionaria`, que crea el registro
 * clínico de la receptora, la transferencia y descuenta el embrión en una sola
 * transacción. No lleva `veterinario_id`: la función lo toma de `auth.uid()`.
 */
export interface RegistrarTransferenciaPayload {
  sociedad_id:          string
  fecha:                string
  caballo_receptora_id: string
  caballo_donante_id:   string
  embrion_id:           string
  padrillo_id:          string | null
  flushing_id:          string | null
  ovario_izq:           string[]
  ovario_der:           string[]
  cl_calidad:           string | null
  tono_uterino:         string | null
  tono_cervical:        string | null
  clasificacion:        'Fresco' | 'Congelado' | null
  notas:                string | null
}

// ---------------------------------------------------------------------------
// Ecografía post-transferencia (Eco 1 / 2 / 3)
// ---------------------------------------------------------------------------

export type ResultadoEcografia = 'prenada' | 'abortada' | 'pendiente'

export const LABEL_RESULTADO_ECO: Record<ResultadoEcografia, string> = {
  prenada:   'Preñada',
  abortada:  'Abortada',
  pendiente: 'Revisar',
}

export interface Ecografia {
  id:                   string
  sociedad_id:          string
  transferencia_id:     string
  caballo_receptora_id: string
  veterinario_id:       string
  numero:               number          // habitualmente 1..3, pero puede haber más
  fecha:                string          // YYYY-MM-DD
  resultado:            ResultadoEcografia
  ovario_izq:           string[]
  ovario_der:           string[]
  notas:                string | null
  created_at:           string
  updated_at:           string
  // joins opcionales
  receptora?:           { nombre: string }
  veterinario?:         { nombre: string; apellido: string }
}

export type NuevaEcografiaPayload = Omit<
  Ecografia,
  'id' | 'created_at' | 'updated_at' | 'receptora' | 'veterinario'
>

// ---------------------------------------------------------------------------
// Ranking de padrillos preferidos por donante — migración 20260802120200
// Definición de Gero (2026-08-02): hasta 10 padrillos por donante, ordenados
// por prioridad (1 = más recomendado, 10 = menos recomendado). La lista es del
// establecimiento y la arman admin o veterinario.
// ---------------------------------------------------------------------------

/** Tope de padrillos que admite el ranking de una donante. */
export const MAX_PADRILLOS_RANKING = 10

export interface PadrilloPreferido {
  id:          string
  donante_id:  string
  padrillo_id: string
  prioridad:   number
  // join opcional
  padrillo?:   { nombre: string } | null
}
