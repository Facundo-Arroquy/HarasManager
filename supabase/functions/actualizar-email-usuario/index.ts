// Cambia el email (el login) de un usuario existente.
//
// Existe porque el email vive en dos lugares que no se sincronizan solos:
// `auth.users` (con el que se inicia sesión, solo editable con la Admin API y
// la service_role) y `public.usuario.email` (lo que muestra la app). El trigger
// de alta copia el email una sola vez, al crear el usuario; no hay nada que lo
// mantenga al día después. Y el propio usuario no puede cambiarlo desde su
// sesión: lo bloquea el trigger `bloquear_self_escalation`.
//
// Orden deliberado:
//   1. `auth.users` primero: es el que valida formato y unicidad, y el que
//      importa para entrar. Se marca como confirmado (`email_confirm: true`)
//      igual que en `create-user`, así no depende de que llegue un mail.
//   2. `public.usuario` después. Si falla, se vuelve `auth.users` al email
//      anterior para no dejar los dos desincronizados.
//
// Quién la puede llamar: solo un superadmin. Se verifica contra la base con el
// JWT del caller, nunca contra algo que venga en el body.
import { createClient } from 'npm:@supabase/supabase-js@2.105.4'

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

    const { usuario_id, email } = await req.json()
    if (!usuario_id || typeof usuario_id !== 'string') {
      return json({ error: 'Falta el usuario.' }, 400)
    }
    const nuevoEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!EMAIL_RE.test(nuevoEmail)) {
      return json({ error: 'El email no es válido.' }, 400)
    }

    const { data: authActual, error: getError } = await supabaseAdmin.auth.admin.getUserById(usuario_id)
    if (getError || !authActual?.user) {
      return json({ error: 'No se encontró el usuario.' }, 404)
    }
    const emailAnterior = authActual.user.email ?? ''
    if (emailAnterior.toLowerCase() === nuevoEmail) {
      return json({ error: 'El usuario ya tiene ese email.' }, 400)
    }

    // Chequeo previo para dar un mensaje claro; la unicidad real la imponen
    // auth.users y el UNIQUE de usuario.email.
    const { data: tomado } = await supabaseAdmin
      .from('usuario')
      .select('id')
      .eq('email', nuevoEmail)
      .neq('id', usuario_id)
      .maybeSingle()
    if (tomado) {
      return json({ error: 'Ese email ya lo usa otro usuario.' }, 409)
    }

    // ── 1. Login ─────────────────────────────────────────────────────────────
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(usuario_id, {
      email: nuevoEmail,
      email_confirm: true,
    })
    if (authError) {
      const yaExiste = /already|registered|exists/i.test(authError.message)
      return json({
        error: yaExiste ? 'Ese email ya lo usa otro usuario.' : authError.message,
      }, yaExiste ? 409 : 400)
    }

    // ── 2. Perfil ────────────────────────────────────────────────────────────
    const { error: perfilError } = await supabaseAdmin
      .from('usuario')
      .update({ email: nuevoEmail })
      .eq('id', usuario_id)

    if (perfilError) {
      const { error: rollbackError } = await supabaseAdmin.auth.admin.updateUserById(usuario_id, {
        email: emailAnterior,
        email_confirm: true,
      })
      if (rollbackError) {
        console.error('Email cambiado en auth.users pero no en usuario, y falló el rollback',
          usuario_id, perfilError, rollbackError)
        return json({
          error: `El login ya quedó con ${nuevoEmail}, pero no se pudo actualizar el perfil (${perfilError.message}). Hay que corregir usuario.email a mano.`,
        }, 500)
      }
      return json({ error: `No se pudo actualizar el email: ${perfilError.message}` }, 400)
    }

    return json({ ok: true, email: nuevoEmail }, 200)
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})
