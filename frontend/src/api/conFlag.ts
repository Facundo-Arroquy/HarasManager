import { usaApi, type Dominio } from './flags'

/**
 * Elige en cada llamada entre el camino de Supabase y el de la API, según el flag del dominio.
 * Es la pieza con la que cada service migra sin dejar de funcionar de la forma actual:
 *
 *   const listar = conFlag('campos', {
 *     supabase: (sociedadId: string) => listarDesdeSupabase(sociedadId),   // el código de hoy
 *     api: (sociedadId: string) => listarDesdeApi(sociedadId),             // el nuevo
 *   })
 *
 * Los dos caminos tienen que devolver lo mismo (misma forma, mismos errores): de eso se ocupan
 * los tests de cada dominio. El flag se lee en cada llamada, no al cargar el módulo.
 */
export function conFlag<A extends unknown[], R>(
  dominio: Dominio,
  caminos: {
    supabase: (...args: A) => Promise<R>
    api: (...args: A) => Promise<R>
  },
  usa: (dominio: Dominio) => boolean = usaApi,
): (...args: A) => Promise<R> {
  return (...args) => (usa(dominio) ? caminos.api(...args) : caminos.supabase(...args))
}
