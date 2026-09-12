/** Convierte una lista de constantes en opciones de un select (`valor` + `etiqueta`). */
export function opcionesDe<T extends string | number>(valores: ReadonlyArray<T>) {
  return valores.map((v) => ({ valor: v, etiqueta: String(v) }))
}
