// Cancela la membresía del veterinario en MercadoPago.
//
// Sin esto, el vet que se suscribe desde la app tiene que ir a buscar la baja
// al panel de MercadoPago: la app le cobra pero no le deja dejar de pagar, que
// es exactamente el patrón que uno no quiere en una suscripción.
//
// Cancelar **no** le corta el acceso en el acto: conserva la membresía hasta la
// `fecha_vencimiento` que ya pagó (ver `vet_suscripcion_activa`). Lo que se
// corta es la renovación.
//
// Quién la puede llamar: el vet logueado, sobre su propia suscripción. El
// `usuario_id` sale del JWT, nunca del body.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type Preapproval = Record<string, unknown> | null

type ResultadoCancelacion =
  | { ok: true; preapproval: Preapproval }
  | { ok: false; status: number; body: unknown; etapa: string }

/** El mensaje que manda MercadoPago en el cuerpo del error, si lo hay. */
function mensajeDeMercadoPago(body: unknown): string | null {
  const m = (body as { message?: unknown } | null)?.message
  return typeof m === 'string' && m.trim() ? m : null
}

/**
 * Cancela el preapproval, consultándolo primero.
 *
 * El único valor válido es `cancelled` con dos eles — la guía de MercadoPago lo
 * escribe con una en algunos párrafos, pero la API responde
 * `Invalid preapproval status param: canceled`.
 *
 * Se consulta antes de escribir porque MercadoPago rechaza con 400 el PUT sobre
 * un preapproval que ya está cancelado, y ese caso no es un error: la baja que
 * el vet pide ya está hecha. Pasaba con las suscripciones que un superadmin
 * reactivó a mano dejando el id del preapproval viejo. Lo mismo con el 404: si
 * el preapproval no existe, no hay nada que pueda cobrar.
 */
async function cancelarEnMercadoPago(
  preapprovalId: string,
  accessToken: string,
): Promise<ResultadoCancelacion> {
  const auth = { 'Authorization': `Bearer ${accessToken}` }
  const url = `https://api.mercadopago.com/preapproval/${preapprovalId}`

  const resGet = await fetch(url, { headers: auth })
  const actual = await resGet.json().catch(() => null) as Preapproval

  if (resGet.status === 404) {
    console.warn('El preapproval no existe en MercadoPago, se da de baja solo local', preapprovalId)
    return { ok: true, preapproval: { status: 'cancelled' } }
  }
  if (!resGet.ok) {
    return { ok: false, status: resGet.status, body: actual, etapa: 'consulta' }
  }

  const estadoMp = String(actual?.status ?? '')
  if (estadoMp === 'cancelled' || estadoMp === 'canceled') {
    console.log('El preapproval ya estaba cancelado en MercadoPago', preapprovalId)
    return { ok: true, preapproval: actual }
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'cancelled' }),
  })
  const body = await res.json().catch(() => null) as Preapproval
  if (res.ok) return { ok: true, preapproval: body }

  return { ok: false, status: res.status, body, etapa: `baja desde estado "${estadoMp}"` }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const accessToken = Deno.env.get('MP_ACCESS_TOKEN')
    if (!accessToken) {
      return json({ error: 'La integración de pagos no está configurada.' }, 503)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'No autorizado' }, 401)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await supabaseUser.auth.getUser()
    if (!user) return json({ error: 'No autorizado' }, 401)

    // Se lee la suscripción del usuario del token: así el id de preapproval que
    // se cancela no puede venir manipulado desde el cliente.
    const { data: suscripcion } = await supabaseAdmin
      .from('suscripcion_veterinario')
      .select('estado, external_subscription_id')
      .eq('usuario_id', user.id)
      .maybeSingle()

    if (!suscripcion?.external_subscription_id) {
      return json({ error: 'No tenés una suscripción de MercadoPago para cancelar.' }, 404)
    }

    if (suscripcion.estado === 'cancelada') {
      return json({ error: 'Tu membresía ya está cancelada.' }, 409)
    }

    const resultado = await cancelarEnMercadoPago(
      suscripcion.external_subscription_id,
      accessToken
    )

    if (!resultado.ok) {
      console.error('MercadoPago rechazó la cancelación',
        suscripcion.external_subscription_id, resultado.etapa, resultado.status, resultado.body)
      const detalle = mensajeDeMercadoPago(resultado.body)
      return json({
        error: detalle
          ? `No se pudo cancelar la membresía en MercadoPago: ${detalle}`
          : 'No se pudo cancelar la membresía. Probá de nuevo en unos minutos.',
      }, 502)
    }

    // El webhook va a llegar igual con el mismo evento, pero sincronizar acá
    // hace que la pantalla del vet quede al día sin esperarlo — y la RPC es
    // idempotente, así que la notificación posterior no rompe nada.
    const preapproval = resultado.preapproval as Record<string, unknown> | null
    const { error: rpcError } = await supabaseAdmin.rpc('mp_sincronizar_suscripcion', {
      p_preapproval_id: suscripcion.external_subscription_id,
      p_status: String(preapproval?.status ?? 'cancelled'),
      p_next_payment_date: preapproval?.next_payment_date ?? null,
      p_payload: preapproval ?? {},
    })

    // La baja en MercadoPago ya está hecha: si falla el registro local, no se
    // devuelve error (sería mentirle al vet). El webhook lo va a corregir.
    if (rpcError) {
      console.error('Cancelado en MercadoPago pero no se pudo sincronizar',
        suscripcion.external_subscription_id, rpcError)
    }

    return json({ ok: true }, 200)
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})
