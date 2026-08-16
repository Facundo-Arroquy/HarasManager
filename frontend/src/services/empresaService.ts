import { getSupabaseClient } from '../lib/supabase'

export interface EmpresaVisible {
  id:     string
  nombre: string
}

/**
 * Las empresas que el usuario logueado puede ver, por membresía o por tener un
 * `acceso_vet` activo sobre alguno de sus caballos.
 *
 * Va por RPC porque la RLS de `sociedad` es `tiene_membresia(id)`: el
 * veterinario no puede leer el nombre de las empresas con las que trabaja con
 * una query directa.
 */
export const empresaService = {
  async listarVisibles(): Promise<EmpresaVisible[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('get_empresas_visibles')
    if (error) throw error
    return (data ?? []) as EmpresaVisible[]
  },

  /** `sociedad_id` → nombre, para resolver el origen de trabajos y consultas. */
  async mapaNombres(): Promise<Map<string, string>> {
    const empresas = await empresaService.listarVisibles()
    return new Map(empresas.map((e) => [e.id, e.nombre]))
  },
}
