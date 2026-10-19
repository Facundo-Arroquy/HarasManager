/**
 * PostgREST corta cada respuesta en `max_rows` filas (1000 por defecto en
 * Supabase) y no avisa: en una lista ordenada por fecha se pierde justo el
 * final, que es lo más nuevo. Esto pide la consulta por páginas hasta que una
 * viene incompleta.
 *
 * - `tamano` no puede superar el `max_rows` de la API: si lo supera, la primera
 *   página ya vendría corta y la lista se daría por terminada.
 * - La consulta tiene que tener un orden total (terminar en `id`): sin eso, las
 *   filas con el mismo valor se repiten o se saltean entre una página y otra.
 */
export const TAMANO_PAGINA = 1000

export async function traerTodo<T>(
  pedirPagina: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  tamano = TAMANO_PAGINA,
): Promise<T[]> {
  const filas: T[] = []
  for (;;) {
    const { data, error } = await pedirPagina(filas.length, filas.length + tamano - 1)
    if (error) throw error
    const pagina = data ?? []
    filas.push(...pagina)
    if (pagina.length < tamano) return filas
  }
}
