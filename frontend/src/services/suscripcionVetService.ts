import { getSupabaseClient } from '../lib/supabase'

/** Plan de membresía vigente. El precio vive en la base, no en el código. */
export interface PlanSuscripcionVet {
  id:              string
  codigo:          string
  nombre:          string
  precio:          number
  moneda:          string
  frecuencia:      number
  frecuencia_tipo: 'days' | 'months'
}

export type EstadoSuscripcion = 'activa' | 'inactiva' | 'pendiente' | 'cancelada'

/** Suscripción del vet logueado. `pendiente` = preapproval abierto, sin pagar. */
export interface SuscripcionVet {
  estado:            EstadoSuscripcion
  fecha_activacion:  string | null
  fecha_vencimiento: string | null
  fecha_cancelacion: string | null
  proveedor_pago:    string | null
}

/** Formatea el precio del plan con la moneda que corresponda. */
export function formatPrecio(plan: PlanSuscripcionVet): string {
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: plan.moneda,
      maximumFractionDigits: 0,
    }).format(plan.precio)
  } catch {
    // Moneda no reconocida por Intl: mejor mostrar el número que romper.
    return `${plan.moneda} ${plan.precio}`
  }
}

/**
 * Período de facturación en texto ("mes", "año", "3 meses"). El plan de hoy es
 * mensual, pero la tabla admite otras frecuencias y el precio no debería
 * mostrarse nunca sin decir cada cuánto se cobra.
 */
export function formatPeriodo(plan: PlanSuscripcionVet): string {
  const { frecuencia, frecuencia_tipo } = plan
  if (frecuencia_tipo === 'months') {
    if (frecuencia === 1)  return 'mes'
    if (frecuencia === 12) return 'año'
    return `${frecuencia} meses`
  }
  return frecuencia === 1 ? 'día' : `${frecuencia} días`
}

export const suscripcionVetService = {
  /** Devuelve null si todavía no hay plan configurado. */
  async planVigente(): Promise<PlanSuscripcionVet | null> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('plan_suscripcion_vet')
      .select('id, codigo, nombre, precio, moneda, frecuencia, frecuencia_tipo')
      .eq('activo', true)
      .maybeSingle()
    if (error) throw error
    return (data as PlanSuscripcionVet | null) ?? null
  },

  /**
   * Suscripción del usuario logueado, o null si no tiene (el caso de un vet de
   * haras o de un admin). Se filtra por `usuario_id` explícitamente y no se
   * confía solo en la RLS: para un superadmin la policy devuelve todas las
   * filas y `maybeSingle()` fallaría.
   */
  async miSuscripcion(): Promise<SuscripcionVet | null> {
    const supabase = getSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('suscripcion_veterinario')
      .select('estado, fecha_activacion, fecha_vencimiento, fecha_cancelacion, proveedor_pago')
      .eq('usuario_id', user.id)
      .maybeSingle()
    if (error) throw error
    return (data as SuscripcionVet | null) ?? null
  },

  /**
   * Crea el preapproval en MercadoPago y devuelve el link del checkout. El
   * usuario sale del JWT del lado de la Edge Function: acá no se manda nada
   * que pueda usarse para pagar en nombre de otro.
   */
  async iniciarCheckout(): Promise<string> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.functions.invoke('crear-suscripcion-vet')

    if (error) {
      // El cuerpo de la respuesta trae el mensaje útil ("Ya tenés una membresía
      // activa", "No hay un plan configurado"); el error de `invoke` solo dice
      // que hubo un status no-2xx.
      let detalle: string | undefined
      const context = (error as { context?: Response }).context
      if (context && typeof context.json === 'function') {
        try {
          const body = await context.json() as { error?: string }
          detalle = body?.error
        } catch { /* la función respondió algo que no es JSON */ }
      }
      throw new Error(detalle ?? 'No se pudo iniciar el pago.')
    }

    const initPoint = (data as { init_point?: string } | null)?.init_point
    if (!initPoint) throw new Error('No se pudo iniciar el pago.')
    return initPoint
  },
}
