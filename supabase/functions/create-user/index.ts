import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verificar que el caller es superadmin
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user: caller } } = await supabaseUser.auth.getUser()
    if (!caller) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: callerPerfil } = await supabaseAdmin
      .from('usuario')
      .select('rol')
      .eq('id', caller.id)
      .single()

    if (callerPerfil?.rol !== 'superadmin') {
      return new Response(JSON.stringify({ error: 'Acceso denegado' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Leer payload. `acceso_centro_cria` (legacy, boolean) se mantiene por
    // compatibilidad con el frontend viejo durante el gap de despliegue;
    // `modulos` (nuevo, genérico) es lo que manda el frontend actualizado.
    const { nombre, apellido, email, password, sociedad_id, rol, acceso_centro_cria, modulos } = await req.json()

    if (!nombre || !apellido || !email || !password || !sociedad_id || !rol) {
      return new Response(JSON.stringify({ error: 'Faltan campos requeridos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Crear usuario en Supabase Auth (sin email de confirmación)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = authData.user.id

    // 2. Upsert en tabla usuario (por si hay trigger, actualiza nombre/apellido)
    const { error: userError } = await supabaseAdmin.from('usuario').upsert({
      id: userId,
      nombre,
      apellido,
      email,
      activo: true,
      ...(rol === 'veterinario' ? { rol: 'veterinario' } : {}),
    })
    if (userError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return new Response(JSON.stringify({ error: userError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Obtener cat_rol id por nombre
    const { data: catRol, error: rolError } = await supabaseAdmin
      .from('cat_rol')
      .select('id')
      .eq('nombre', rol)
      .single()
    if (rolError || !catRol) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return new Response(JSON.stringify({ error: `Rol "${rol}" no encontrado` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Crear membresía
    const { data: membData, error: membError } = await supabaseAdmin
      .from('membresia')
      .insert({ usuario_id: userId, sociedad_id, rol_id: catRol.id, activa: true })
      .select('id')
      .single()
    if (membError || !membData) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return new Response(JSON.stringify({ error: membError?.message ?? 'Error al crear membresía' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 5. Accesos a módulos — `modulos` genérico, o el `acceso_centro_cria` legacy
    const modulosAHabilitar: string[] = []
    if (modulos && typeof modulos === 'object') {
      for (const [codigo, habilitado] of Object.entries(modulos)) {
        if (habilitado) modulosAHabilitar.push(codigo)
      }
    } else if (acceso_centro_cria) {
      modulosAHabilitar.push('centro_cria')
    }

    if (modulosAHabilitar.length > 0) {
      const { data: catModulos, error: catModuloError } = await supabaseAdmin
        .from('cat_modulo')
        .select('id, codigo')
        .in('codigo', modulosAHabilitar)
      if (catModuloError) {
        await supabaseAdmin.auth.admin.deleteUser(userId)
        return new Response(JSON.stringify({ error: catModuloError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const encontrados = new Set((catModulos ?? []).map((m) => m.codigo))
      const faltantes = modulosAHabilitar.filter((codigo) => !encontrados.has(codigo))
      if (faltantes.length > 0) {
        await supabaseAdmin.auth.admin.deleteUser(userId)
        return new Response(JSON.stringify({ error: `Módulo(s) no encontrado(s): ${faltantes.join(', ')}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const filas = (catModulos ?? []).map((m) => ({ membresia_id: membData.id, modulo_id: m.id, habilitado: true }))
      if (filas.length > 0) {
        const { error: moduloError } = await supabaseAdmin.from('membresia_modulo').insert(filas)
        if (moduloError) {
          await supabaseAdmin.auth.admin.deleteUser(userId)
          return new Response(JSON.stringify({ error: moduloError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    return new Response(JSON.stringify({ user_id: userId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
