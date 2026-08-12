import { getSupabaseClient } from '../lib/supabase'

/** Estado del límite freemium del vet logueado (RPC `vet_estado_limite`). */
export interface EstadoLimiteVet {
  caballos_propios:   number
  limite:             number
  suscripcion_activa: boolean
  /** Cuántos caballos sobran por encima del plan gratuito. 0 si está en regla. */
  excedente:          number
  /** true → excedió el plan gratuito y no tiene suscripción vigente. */
  debe_regularizar:   boolean
}

/** Caballo propio del vet, con lo necesario para decidir cuál dar de baja. */
export interface CaballoPropioVet {
  id:               string
  nombre:           string
  categoria:        string | null
  fecha_nacimiento: string | null
  raza_nombre:      string | null
  pelaje_nombre:    string | null
  created_at:       string
  consultas:        number
  ultima_consulta:  string | null
}

/** Caballo propio dado de baja, candidato a reactivación. */
export interface CaballoInactivoVet {
  id:               string
  nombre:           string
  categoria:        string | null
  fecha_nacimiento: string | null
  raza_nombre:      string | null
  pelaje_nombre:    string | null
  /** Aproximada por `updated_at`: no hay columna de fecha de baja en `caballo`. */
  fecha_baja:       string
  consultas:        number
}

export const vetLimiteService = {
  /**
   * Se consulta al entrar a la app. Devuelve null si el usuario no es un vet
   * con caballos propios — la RPC responde igual, pero para un vet de haras
   * el conteo es 0 y `debe_regularizar` siempre false.
   */
  async estado(): Promise<EstadoLimiteVet> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('vet_estado_limite')
    if (error) throw error
    // La RPC devuelve TABLE, así que llega como array de una fila.
    const fila = (data as EstadoLimiteVet[] | null)?.[0]
    if (!fila) throw new Error('No se pudo verificar el estado de tu plan.')
    return fila
  },

  async listarPropios(): Promise<CaballoPropioVet[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('get_caballos_propios_vet')
    if (error) throw error
    return (data ?? []) as CaballoPropioVet[]
  },

  /**
   * Baja lógica en lote. La función de base valida que todos los ids sean
   * caballos propios y activos del vet; si alguno no lo es, falla entera.
   * Devuelve cuántos se dieron de baja.
   */
  async darDeBajaLote(ids: string[]): Promise<number> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('dar_de_baja_caballos_veterinario', {
      p_caballo_ids: ids,
    })
    if (error) throw error
    return (data as number) ?? 0
  },

  async listarInactivos(): Promise<CaballoInactivoVet[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('get_caballos_propios_vet_inactivos')
    if (error) throw error
    return (data ?? []) as CaballoInactivoVet[]
  },

  /**
   * Reactiva caballos dados de baja. La función de base aplica el mismo gate
   * que el alta: sin suscripción vigente solo se puede reactivar hasta llenar
   * el cupo del plan gratuito, para que dar de baja y reactivar no sea una
   * forma trivial de evadir el límite.
   */
  async reactivarLote(ids: string[]): Promise<number> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('reactivar_caballos_veterinario', {
      p_caballo_ids: ids,
    })
    if (error) throw error
    return (data as number) ?? 0
  },
}
