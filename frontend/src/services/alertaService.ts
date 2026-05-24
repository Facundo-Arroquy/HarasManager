import { getSupabaseClient } from '../lib/supabase'

export interface Alerta {
  id: string
  motivo: string
  fecha_alerta: string   // ISO date YYYY-MM-DD
  activo: boolean
  creado_en: string
  caballos: { id: string; nombre: string }[]
}

export const alertaService = {

  /** Miembros de sociedad pasan sociedadId. Veterinarios pasan userId. */
  async listar(params: { sociedadId?: string; userId?: string; esVet: boolean }): Promise<Alerta[]> {
    const supabase = getSupabaseClient()

    let query = supabase
      .from('alerta')
      .select(`id, motivo, fecha_alerta, activo, creado_en,
               alerta_caballo(caballo_id, caballo(id, nombre))`)
      .eq('activo', true)
      .order('fecha_alerta', { ascending: true })

    if (params.esVet) {
      query = query.is('sociedad_id', null)
    } else {
      query = query.eq('sociedad_id', params.sociedadId!)
    }

    const { data, error } = await query
    if (error) throw error

    return (data ?? []).map((a: any) => ({
      id:           a.id,
      motivo:       a.motivo,
      fecha_alerta: a.fecha_alerta,
      activo:       a.activo,
      creado_en:    a.creado_en,
      caballos:     (a.alerta_caballo ?? []).map((ac: any) => ({
        id:     ac.caballo?.id,
        nombre: ac.caballo?.nombre ?? '—',
      })).filter((c: any) => c.id),
    }))
  },

  async crear(payload: {
    sociedad_id: string | null
    motivo: string
    dias: number
    caballo_ids: string[]
    creado_por: string
  }): Promise<string> {
    const supabase = getSupabaseClient()

    const fecha = new Date()
    fecha.setDate(fecha.getDate() + payload.dias)
    const fechaStr = fecha.toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('alerta')
      .insert({
        sociedad_id:  payload.sociedad_id,
        motivo:       payload.motivo.trim(),
        fecha_alerta: fechaStr,
        creado_por:   payload.creado_por,
      })
      .select('id')
      .single()

    if (error) throw error

    if (payload.caballo_ids.length > 0) {
      const { error: errCab } = await supabase
        .from('alerta_caballo')
        .insert(payload.caballo_ids.map((cid) => ({ alerta_id: data.id, caballo_id: cid })))
      if (errCab) throw errCab
    }

    return data.id
  },

  async crearMultiples(payload: {
    sociedad_id: string | null
    alertas: { motivo: string; dias: number }[]
    caballo_ids: string[]
    creado_por: string
  }): Promise<void> {
    for (const a of payload.alertas) {
      await alertaService.crear({
        sociedad_id: payload.sociedad_id,
        motivo:      a.motivo,
        dias:        a.dias,
        caballo_ids: payload.caballo_ids,
        creado_por:  payload.creado_por,
      })
    }
  },

  async eliminar(id: string): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('alerta')
      .update({ activo: false })
      .eq('id', id)
    if (error) throw error
  },
}
