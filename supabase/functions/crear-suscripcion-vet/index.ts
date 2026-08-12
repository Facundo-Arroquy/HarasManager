// Abre el checkout de la membresía del veterinario en MercadoPago.
//
// Crea un preapproval (suscripción sin plan asociado, en estado `pending`) y
// devuelve el `init_point` al que hay que mandar al vet. El medio de pago lo
// carga él en el checkout de MercadoPago: acá no se tocan datos de tarjeta,
// justamente para no quedar dentro del alcance de PCI.
//
// Quién la puede llamar: cualquier usuario logueado con rol veterinario, para
// sí mismo. El `usuario_id` sale del JWT, nunca del body.
//
// Variables de entorno (secrets del proyecto Supabase):
//   MP_ACCESS_TOKEN — access token de la aplicación de MercadoPago
//   APP_URL         — origen del frontend, para el back_url del checkout
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

    // El checkout es solo para el vet independiente: para el resto de los roles
    // la membresía no significa nada.
    const { data: perfil } = await supabaseAdmin
      .from('usuario')
      .select('rol, email')
      .eq('id', user.id)
      .single()

    if (perfil?.rol !== 'veterinario') {
      return json({ error: 'Acceso denegado' }, 403)
    }

    // Una suscripción vigente no se vuelve a cobrar. Sin este corte, un doble
    // clic en "Retomar membresía" deja dos preapprovals cobrando en paralelo.
    const { data: suscripcion } = await supabaseAdmin
      .from('suscripcion_veterinario')
      .select('estado, fecha_vencimiento')
      .eq('usuario_id', user.id)
      .maybeSingle()

    const vigente = suscripcion?.estado === 'activa' &&
      (!suscripcion.fecha_vencimiento || new Date(suscripcion.fecha_vencimiento) > new Date())
    if (vigente) {
      return json({ error: 'Ya tenés una membresía activa.' }, 409)
    }

    const { data: plan, error: planError } = await supabaseAdmin
      .from('plan_suscripcion_vet')
      .select('id, nombre, precio, moneda, frecuencia, frecuencia_tipo')
      .eq('activo', true)
      .single()

    if (planError || !plan) {
      return json({ error: 'No hay un plan de membresía configurado.' }, 503)
    }

    const email = perfil.email ?? user.email
    if (!email) return json({ error: 'Tu usuario no tiene email asociado.' }, 400)

    // Se saca la barra final si la trae: `https://app/` + `/suscripcion/...`
    // daría una doble barra, y MercadoPago valida el formato del back_url.
    const appUrl = (Deno.env.get('APP_URL') ?? '').replace(/\/+$/, '')

    const preapprovalReq = {
      reason: plan.nombre,
      // Deja el vínculo con nuestro usuario del lado de MercadoPago, para poder
      // reconstruir a quién corresponde un pago si hiciera falta auditarlo.
      external_reference: user.id,
      payer_email: email,
      auto_recurring: {
        frequency: plan.frecuencia,
        frequency_type: plan.frecuencia_tipo,
        transaction_amount: Number(plan.precio),
        currency_id: plan.moneda,
      },
      back_url: `${appUrl}/suscripcion/resultado`,
      // `pending`: la suscripción nace sin medio de pago y el vet lo carga en
      // el checkout. La alternativa (`authorized`) exige tokenizar la tarjeta
      // en nuestro frontend.
      status: 'pending',
    }

    const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        // Un reintento de red no crea dos suscripciones para el mismo vet.
        'X-Idempotency-Key': `suscripcion-vet-${user.id}-${Date.now()}`,
      },
      body: JSON.stringify(preapprovalReq),
    })

    const preapproval = await mpRes.json().catch(() => null)

    if (!mpRes.ok || !preapproval?.id || !preapproval?.init_point) {
      console.error('MercadoPago rechazó el preapproval', mpRes.status, preapproval)
      return json({ error: 'No se pudo iniciar el pago. Probá de nuevo en unos minutos.' }, 502)
    }

    // Se guarda el id ANTES de devolver el link: es lo que le permite al
    // webhook saber de quién es el evento que va a llegar después.
    const { error: rpcError } = await supabaseAdmin.rpc('mp_registrar_preapproval', {
      p_usuario_id: user.id,
      p_preapproval_id: preapproval.id,
      p_plan_id: plan.id,
    })

    if (rpcError) {
      console.error('No se pudo registrar el preapproval', preapproval.id, rpcError)
      return json({ error: 'No se pudo iniciar el pago. Probá de nuevo en unos minutos.' }, 500)
    }

    return json({ init_point: preapproval.init_point, preapproval_id: preapproval.id }, 200)
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})
