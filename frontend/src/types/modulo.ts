// =============================================================================
// Sistema de módulos por empresa — migración 20260810140000
// =============================================================================
// Catálogo `cat_modulo` + 3 tablas puente (sociedad/membresia/usuario_modulo)
// en vez de una columna booleana por módulo. Sumar un módulo nuevo es un
// INSERT en cat_modulo, no una migración de schema ni un cambio de tipos acá.
// =============================================================================

export type ModuloCodigo = 'centro_cria' | 'polo'

export interface AccesoModulo {
  /** sociedad_modulo — habilitado a nivel organización (siempre false para veterinarios, que no tienen sociedad). */
  org: boolean
  /** membresia_modulo (usuarios normales) o usuario_modulo (veterinarios) — override individual. */
  usuario: boolean
}

export interface Modulo {
  id: number
  codigo: ModuloCodigo
  nombre: string
  activo: boolean
}
