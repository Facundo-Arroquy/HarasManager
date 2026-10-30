import type { Embrion } from '../types/crianza'

/**
 * Empresa dueña de un embrión.
 *
 * Regla de negocio: el embrión es de la empresa dueña de la donante a la que
 * se le extrajo. No hay columna aparte: `embrion.sociedad_id` ya es esa
 * empresa. Se fija al crear el embrión (la donante se elige entre los animales
 * de esa sociedad, y en el vitrificado manual la RLS exige
 * `caballo.sociedad_id = embrion.sociedad_id`), y a propósito NO se actualiza si
 * la donante se vende después: lo extraído antes de la venta sigue siendo del
 * vendedor.
 */
export interface EmpresaDuenia {
  /** `sociedad_id`, o `OTRA_EMPRESA_ID` si el usuario no puede leer esa empresa. */
  id:     string
  nombre: string
}

/**
 * Nombre que se muestra cuando la empresa dueña no está entre las que el
 * usuario puede leer (`get_empresas_visibles`): empresa dada de baja, un vet
 * que conserva el acceso a una donante que cambió de empresa, o la consulta
 * de nombres que falló.
 */
export const EMPRESA_NO_VISIBLE = 'Otra empresa'

/**
 * Todas las empresas ilegibles van juntas bajo una sola clave: si se
 * distinguieran por `sociedad_id`, el filtro ofrecería varias opciones
 * idénticas ("Otra empresa", "Otra empresa") imposibles de diferenciar.
 */
export const OTRA_EMPRESA_ID = '__otra_empresa__'

type ConDuenia = Pick<Embrion, 'sociedad_id'>
type Nombres = ReadonlyMap<string, string>

/** `nombres`: `sociedad_id` → nombre, de `empresaService.mapaNombres()`. */
export function empresaDuenia(embrion: ConDuenia, nombres: Nombres): EmpresaDuenia {
  const nombre = nombres.get(embrion.sociedad_id)
  return nombre === undefined
    ? { id: OTRA_EMPRESA_ID, nombre: EMPRESA_NO_VISIBLE }
    : { id: embrion.sociedad_id, nombre }
}

/** Empresas dueñas distintas de la lista, ordenadas por nombre: opciones del filtro. */
export function opcionesDuenia(embriones: ConDuenia[], nombres: Nombres): EmpresaDuenia[] {
  const porId = new Map<string, EmpresaDuenia>()
  for (const e of embriones) {
    const duenia = empresaDuenia(e, nombres)
    if (!porId.has(duenia.id)) porId.set(duenia.id, duenia)
  }
  return [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/**
 * Deja en la selección solo las empresas que todavía tienen embriones en la
 * lista. Sin esto, tras recargar (por ejemplo al borrar el último embrión de
 * una empresa) quedaría activo un filtro que ya no se puede ver ni limpiar.
 */
export function seleccionVigente(
  seleccion: ReadonlySet<string>,
  embriones: ConDuenia[],
  nombres: Nombres,
): Set<string> {
  const presentes = new Set(embriones.map((e) => empresaDuenia(e, nombres).id))
  return new Set([...seleccion].filter((id) => presentes.has(id)))
}

/** Embriones de las empresas elegidas. Selección vacía = no filtra. */
export function filtrarPorDuenia<T extends ConDuenia>(
  embriones: T[],
  seleccion: ReadonlySet<string>,
  nombres: Nombres,
): T[] {
  if (seleccion.size === 0) return embriones
  return embriones.filter((e) => seleccion.has(empresaDuenia(e, nombres).id))
}
