import type { Embrion, EstadoEmbrion } from '../types/crianza'

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

/** `nombres`: `sociedad_id` → nombre, de `useNombresEmpresa()`. */
export function empresaDuenia(embrion: ConDuenia, nombres: Nombres): EmpresaDuenia {
  const nombre = nombres.get(embrion.sociedad_id)
  return nombre === undefined
    ? { id: OTRA_EMPRESA_ID, nombre: EMPRESA_NO_VISIBLE }
    : { id: embrion.sociedad_id, nombre }
}

/**
 * Empresas dueñas distintas de la lista, ordenadas por nombre: opciones del
 * filtro. `sociedad.nombre` no es único, así que si dos empresas se llaman
 * igual se les agrega un número ("Haras X (1)", "Haras X (2)", por orden de
 * id) para que se puedan distinguir en el filtro y en la tabla.
 */
export function opcionesDuenia(embriones: ConDuenia[], nombres: Nombres): EmpresaDuenia[] {
  const porId = new Map<string, EmpresaDuenia>()
  for (const e of embriones) {
    const duenia = empresaDuenia(e, nombres)
    if (!porId.has(duenia.id)) porId.set(duenia.id, duenia)
  }
  const ordenadas = [...porId.values()].sort(
    (a, b) => a.nombre.localeCompare(b.nombre, 'es') || a.id.localeCompare(b.id),
  )

  const repetidas = new Map<string, number>()
  for (const o of ordenadas) repetidas.set(o.nombre, (repetidas.get(o.nombre) ?? 0) + 1)
  const numerados = new Map<string, number>()
  return ordenadas.map((o) => {
    if ((repetidas.get(o.nombre) ?? 0) < 2) return o
    const n = (numerados.get(o.nombre) ?? 0) + 1
    numerados.set(o.nombre, n)
    return { ...o, nombre: `${o.nombre} (${n})` }
  })
}

/** `id` de empresa → rótulo, tal como lo ofrece el filtro (`opcionesDuenia`). */
export function rotulosDuenia(opciones: EmpresaDuenia[]): ReadonlyMap<string, string> {
  return new Map(opciones.map((o) => [o.id, o.nombre]))
}

/**
 * Deja en la selección solo las empresas que todavía están entre las
 * `opciones`. Sin esto, tras recargar (por ejemplo al borrar el último embrión
 * de una empresa) quedaría activo un filtro que ya no se puede ver ni limpiar.
 */
export function seleccionVigente(
  seleccion: ReadonlySet<string>,
  opciones: EmpresaDuenia[],
): Set<string> {
  const ids = new Set(opciones.map((o) => o.id))
  return new Set([...seleccion].filter((id) => ids.has(id)))
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

export interface VistaEmbriones<T> {
  /** Los de las empresas elegidas, sin mirar el estado: base de los contadores. */
  deLaEmpresa: T[]
  /** Los que muestra la tabla: empresas elegidas y, además, el estado elegido. */
  visibles:    T[]
  /** Cantidad por estado, dentro de `deLaEmpresa`. */
  counts:      Record<string, number>
}

/**
 * Lo que muestra la página de Embriones. El filtro por empresa acota también
 * los contadores, para que los números de las tarjetas y de los chips
 * coincidan con lo que lista la tabla.
 */
export function vistaEmbriones<T extends ConDuenia & { estado: EstadoEmbrion }>(
  embriones: T[],
  nombres: Nombres,
  empresas: ReadonlySet<string>,
  estado: EstadoEmbrion | 'todos',
): VistaEmbriones<T> {
  const deLaEmpresa = filtrarPorDuenia(embriones, empresas, nombres)
  const visibles = estado === 'todos' ? deLaEmpresa : deLaEmpresa.filter((e) => e.estado === estado)
  const counts: Record<string, number> = {}
  for (const e of deLaEmpresa) counts[e.estado] = (counts[e.estado] ?? 0) + 1
  return { deLaEmpresa, visibles, counts }
}
