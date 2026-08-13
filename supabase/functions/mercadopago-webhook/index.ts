// Webhook de MercadoPago: mantiene el estado de la membresía del vet en sincro
// con lo que pasa del lado de la pasarela (autorización, cobros, pausa, baja).
//
// Sin esto la Fase 2 no cierra: el vet paga en MercadoPago y la app nunca se
// entera, porque el checkout termina en un redirect que el vet puede no
// completar nunca.
//
// Tres reglas que valen para cualquier webhook de pagos y que acá se cumplen:
//
//   1. Validar la firma antes de mirar el contenido. Sin eso, cualquiera que
//      conozca la URL se activa la membresía con un POST.
//   2. No confiar en el body. La notificación trae un id; el estado se consulta
//      contra la API de MercadoPago con nuestro access token.
//   3. Responder 200 a lo que se procesó y a lo que se ignora. MercadoPago
//      reintenta lo que no responde 2xx, así que un tópico que no nos interesa
//      tiene que salir con 200 o queda reintentándose para siempre.
//
// Se despliega con `--no-verify-jwt`: MercadoPago no manda un JWT de Supabase.
// La autenticación de esta función es la firma HMAC, no el JWT.
//
// Variables de entorno (secrets del proyecto Supabase):
//   MP_ACCESS_TOKEN   — access token de la aplicación de MercadoPago
//   MP_WEBHOOK_SECRET — "clave secreta" de Webhooks de la aplicación
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** Tópicos que nos interesan. El resto se ignora con 200. */
const TOPIC_PREAPPROVAL = 'subscription_preapproval'
const TOPIC_PAGO        = 'subscription_authorized_payment'

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Comparación en tiempo constante: comparar con === filtra por prefijo. */
function igualSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let dif = 0
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return dif === 0
}

/**
 * Valida el header `x-signature` según el esquema de MercadoPago: HMAC-SHA256
 * en hexadecimal sobre el manifest `id:...;request-id:...;ts:...;`, con la
 * clave secreta de la aplicación.
 *
 * Las partes que no vinieron en la notificación se omiten del manifest (no se
 * mandan vacías), y el `data.id` va en minúsculas.
 */
async function firmaValida(req: Request, secret: string): Promise<boolean> {
  const xSignature = req.headers.get('x-signature')
  if (!xSignature) return false

  let ts = ''
  let v1 = ''
  for (const parte of xSignature.split(',')) {
    const [clave, valor] = parte.split('=', 2)
    if (!clave || !valor) continue
    if (clave.trim() === 'ts') ts = valor.trim()
    if (clave.trim() === 'v1') v1 = valor.trim()
  }
  if (!ts || !v1) return false

  const url = new URL(req.url)
  const dataId    = url.searchParams.get('data.id')
  const requestId = req.headers.get('x-request-id')

  let manifest = ''
  if (dataId)    manifest += `id:${dataId.toLowerCase()};`
  if (requestId) manifest += `request-id:${requestId};`
  manifest += `ts:${ts};`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const firma = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest))
  return igualSeguro(hex(firma), v1.toLowerCase())
}

async function mpGet(recurso: string, accessToken: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`https://api.mercadopago.com${recurso}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    console.error('MercadoPago respondió', res.status, 'a', recurso)
    return null
  }
  return await res.json().catch(() => null)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const accessToken = Deno.env.get('MP_ACCESS_TOKEN')
  const secret      = Deno.env.get('MP_WEBHOOK_SECRET')
  if (!accessToken || !secret) {
    console.error('Faltan MP_ACCESS_TOKEN o MP_WEBHOOK_SECRET')
    return new Response('Not configured', { status: 503 })
  }

  if (!await firmaValida(req, secret)) {
    // 401 y no 400: es un origen que no pudimos autenticar.
    return new Response('Invalid signature', { status: 401 })
  }

  const url  = new URL(req.url)
  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  // El tópico llega en el body (`type`) o en la query (`topic`), según cómo se
  // haya configurado la notificación.
  const topic = String(body.type ?? url.searchParams.get('type') ?? url.searchParams.get('topic') ?? '')
  // El id del body sirve solo como respaldo del de la query; el de la query es
  // el que se firmó.
  const dataId = url.searchParams.get('data.id')
    ?? String((body.data as Record<string, unknown> | undefined)?.id ?? '')

  if (!dataId) return new Response('OK', { status: 200 })

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    if (topic === TOPIC_PREAPPROVAL) {
      const preapproval = await mpGet(`/preapproval/${dataId}`, accessToken)
      if (!preapproval?.status) return new Response('Upstream error', { status: 500 })

      const { error } = await supabaseAdmin.rpc('mp_sincronizar_suscripcion', {
        p_preapproval_id: String(preapproval.id ?? dataId),
        p_status: String(preapproval.status),
        p_next_payment_date: preapproval.next_payment_date ?? null,
        p_payload: preapproval,
      })
      // La suscripción puede no ser nuestra (misma cuenta de MercadoPago usada
      // para otra cosa): se registra y se corta con 200 para no entrar en un
      // ciclo de reintentos que nunca va a resolverse.
      if (error) {
        console.error('No se pudo sincronizar el preapproval', dataId, error)
        return new Response('OK', { status: 200 })
      }
      return new Response('OK', { status: 200 })
    }

    if (topic === TOPIC_PAGO) {
      const factura = await mpGet(`/authorized_payments/${dataId}`, accessToken)
      if (!factura) return new Response('Upstream error', { status: 500 })

      const preapprovalId = factura.preapproval_id ? String(factura.preapproval_id) : null
      if (!preapprovalId) return new Response('OK', { status: 200 })

      const pago = factura.payment as Record<string, unknown> | undefined

      const { error } = await supabaseAdmin.rpc('mp_registrar_pago', {
        p_preapproval_id: preapprovalId,
        // Preferimos el id del pago real; si la cuota todavía no generó pago,
        // el id de la factura alcanza para que el registro sea idempotente.
        p_payment_id: String(pago?.id ?? factura.id ?? dataId),
        p_estado: String(pago?.status ?? factura.status ?? 'desconocido'),
        p_monto: factura.transaction_amount ?? null,
        p_moneda: factura.currency_id ?? null,
        p_fecha: factura.debit_date ?? factura.date_created ?? null,
        p_payload: factura,
      })
      if (error) {
        console.error('No se pudo registrar el pago', dataId, error)
        return new Response('OK', { status: 200 })
      }

      // Un cobro cambia la fecha del próximo débito, y con ella el vencimiento
      // de la membresía: se re-consulta la suscripción en vez de deducirla.
      const preapproval = await mpGet(`/preapproval/${preapprovalId}`, accessToken)
      if (preapproval?.status) {
        const { error: syncError } = await supabaseAdmin.rpc('mp_sincronizar_suscripcion', {
          p_preapproval_id: preapprovalId,
          p_status: String(preapproval.status),
          p_next_payment_date: preapproval.next_payment_date ?? null,
          p_payload: preapproval,
        })
        if (syncError) console.error('No se pudo sincronizar tras el pago', preapprovalId, syncError)
      }

      return new Response('OK', { status: 200 })
    }

    // Tópico que no nos interesa (`payment`, `merchant_order`, …).
    return new Response('OK', { status: 200 })
  } catch (err) {
    // 500 para que MercadoPago reintente: un error nuestro no debería perder
    // el evento.
    console.error(err)
    return new Response('Internal error', { status: 500 })
  }
})
