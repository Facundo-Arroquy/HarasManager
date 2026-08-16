import { getSupabaseClient } from '../lib/supabase'

/**
 * Notificaciones in-app. La tabla es genérica a propósito: el primer emisor es
 * el plan sanitario compartido, pero la idea es que después la usen
 * transferencias, accesos y vencimientos.
 *
 * Nadie escribe acá desde el cliente — no hay policy de INSERT. Las crean las
 * funciones SECURITY DEFINER, dentro de la misma transacción que el hecho que
 * se está notificando.
 */
export interface Notificacion {
  id:         string
  tipo:       string
  titulo:     string
  cuerpo:     string | null
  link:       string | null
  leida:      boolean
  created_at: string
}

const LIMITE = 20

export const notificacionService = {
  /** Las últimas del usuario logueado (vía RLS). */
  async listar(): Promise<Notificacion[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('notificacion')
      .select('id, tipo, titulo, cuerpo, link, leida, created_at')
      .order('created_at', { ascending: false })
      .limit(LIMITE)
    if (error) throw error
    return (data ?? []) as Notificacion[]
  },

  async marcarLeida(id: string): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('notificacion').update({ leida: true }).eq('id', id)
    if (error) throw error
  },

  async marcarTodasLeidas(): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('notificacion')
      .update({ leida: true })
      .eq('leida', false)
    if (error) throw error
  },
}
