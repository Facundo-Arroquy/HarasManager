// Borra un usuario de forma definitiva: perfil, datos propios y login.
//
// Existe porque el borrado real vive en dos sistemas que no comparten
// transacción: `public.usuario` (con todo su grafo de FK) y `auth.users` (que
// solo se toca con la Admin API y la service_role). El frontend no puede hacer
// ninguna de las dos cosas, así que esto es lo que las coordina.
//
// Orden deliberado — cada paso es la condición del siguiente:
//
//   1. Cancelar la suscripción en MercadoPago, si hay una viva. Si el usuario
//      desaparece de la base con el preapproval activo, MercadoPago le sigue
//      cobrando la tarjeta y ya no queda de nuestro lado a quién atribuirlo.
//      Si esto falla, se aborta: es preferible no borrar a dejar un cobro huérfano.
//   2. `superadmin_eliminar_usuario`, que valida y purga en una sola
//      transacción. Es también la guarda de autorización real y la que rechaza
//      si el usuario dejó datos de terceros.
//   3. Recién ahí, borrar de `auth.users`.
//
// Quién la puede llamar: solo un superadmin. Se verifica contra la base con el
// JWT del caller, nunca contra algo que venga en el body.
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

/**
 * Misma cancelación que `cancelar-suscripcion-vet`: se consulta el preapproval
 * antes de escribirlo, porque MercadoPago rechaza con 400 el PUT sobre uno que
 * ya está cancelado y ese caso no debe frenar el borrado del usuario. El único
 * valor de estado válido es `cancelled` con dos eles.
 */
async function cancelarEnMercadoPago(preapprovalId: string, accessToken: string) {
  const auth = { 'Authorization': `Bearer ${accessToken}` }
  const url = `https://api.mercadopago.com/preapproval/${preapprovalId}`

  const resGet = await fetch(url, { headers: auth })
  const actual = await resGet.json().catch(() => null) as Record<string, unknown> | null

  // El preapproval no existe: no hay nada que pueda seguir cobrando.
  if (resGet.status === 404) return { ok: true as const }
  if (!resGet.ok) {
    return { ok: false as const, status: resGet.status, body: actual, etapa: 'consulta' }
  }

  const estadoMp = String(actual?.status ?? '')
  if (estadoMp === 'cancelled' || estadoMp === 'canceled') return { ok: true as const }

  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'cancelled' }),
  })
  const body = await res.json().catch(() => null)
  if (res.ok) return { ok: true as const }

  return { ok: false as const, status: res.status, body, etapa: `baja desde estado "${estadoMp}"` }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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
    const { data: { user: caller } } = await supabaseUser.auth.getUser()
    if (!caller) return json({ error: 'No autorizado' }, 401)

    const { data: callerPerfil } = await supabaseAdmin
      .from('usuario')
      .select('rol')
      .eq('id', caller.id)
      .single()

    if (callerPerfil?.rol !== 'superadmin') {
      return json({ error: 'Acceso denegado' }, 403)
    }

    const { usuario_id } = await req.json()
    if (!usuario_id || typeof usuario_id !== 'string') {
      return json({ error: 'Falta el usuario a eliminar.' }, 400)
    }
    if (usuario_id === caller.id) {
      return json({ error: 'No podés eliminar tu propio usuario.' }, 400)
    }

    // ── 1. MercadoPago ───────────────────────────────────────────────────────
    // Se lee antes de purgar, porque la RPC se lleva puesta la suscripción.
    const { data: suscripcion } = await supabaseAdmin
      .from('suscripcion_veterinario')
      .select('estado, external_subscription_id')
      .eq('usuario_id', usuario_id)
      .maybeSingle()

    let suscripcionCancelada = false
    if (suscripcion?.external_subscription_id && suscripcion.estado !== 'cancelada') {
      const accessToken = Deno.env.get('MP_ACCESS_TOKEN')
      if (!accessToken) {
        return json({
          error: 'El usuario tiene una suscripción de MercadoPago activa y la integración de pagos no está configurada. No se eliminó nada.',
        }, 503)
      }

      const resultado = await cancelarEnMercadoPago(
        suscripcion.external_subscription_id,
        accessToken
      )
      if (!resultado.ok) {
        console.error('No se pudo cancelar el preapproval antes de eliminar',
          suscripcion.external_subscription_id, resultado.etapa, resultado.status, resultado.body)
        return json({
          error: 'No se pudo cancelar la suscripción de MercadoPago, así que no se eliminó el usuario. Si se borrara igual, MercadoPago seguiría cobrando sin registro local. Probá de nuevo en unos minutos.',
        }, 502)
      }
      suscripcionCancelada = true
    }

    // ── 2. Purga del esquema public (valida y borra en una transacción) ──────
    // Con `supabaseUser` (JWT del caller), no con `supabaseAdmin`: la RPC
    // revalida `is_superadmin()` internamente vía `auth.uid()`, y con la key de
    // service_role ese valor es NULL — la función se rechazaría a sí misma.
    const { data: resumen, error: rpcError } = await supabaseUser
      .rpc('superadmin_eliminar_usuario', { p_usuario_id: usuario_id })

    if (rpcError) {
      // La RPC ya devuelve mensajes pensados para mostrarle al superadmin
      // (incluye la lista de qué lo bloquea), así que se propaga tal cual.
      const bloqueado = rpcError.code === 'HM409'
      return json({ error: rpcError.message, suscripcion_cancelada: suscripcionCancelada },
        bloqueado ? 409 : 400)
    }

    // ── 3. Login ─────────────────────────────────────────────────────────────
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(usuario_id)
    if (authError) {
      // El perfil ya no está, así que el usuario no puede entrar; pero mientras
      // quede la fila en auth.users el email sigue tomado y no va a poder
      // registrarse de nuevo. Se dice explícitamente en vez de devolver ok.
      console.error('Perfil eliminado pero auth.users no', usuario_id, authError)
      return json({
        error: `Se eliminaron los datos del usuario, pero no se pudo borrar su login: ${authError.message}. Hay que eliminarlo desde Authentication → Users en Supabase para liberar el email.`,
      }, 500)
    }

    return json({ ok: true, ...(resumen ?? {}), suscripcion_cancelada: suscripcionCancelada }, 200)
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})
