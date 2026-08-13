import { useEffect } from 'react'
import { getSupabaseClient } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { getMisAccesos } from '../services/moduloService'
import { tieneAccesoModulo } from '../utils/modulos'
import type { ModuloCodigo } from '../types/modulo'

// Carga el perfil desde Supabase y configura el store según el rol del usuario.
// Solo corre si rol todavía no fue cargado (evita llamadas redundantes en remounts).
async function cargarPerfilProd(
  userId: string,
  supabase: ReturnType<typeof getSupabaseClient>
) {
  const store = useAuthStore.getState()
  if (store.rol !== null) return // ya cargado, no repetir

  try {
    const { data: perfil } = await supabase
      .from('usuario')
      .select('rol')
      .eq('id', userId)
      .single()

    if (perfil?.rol === 'superadmin') {
      store.setRolSuperAdmin()
      return
    }

    if (perfil?.rol === 'veterinario') {
      const modulos = await getMisAccesos().catch(() => ({}))
      store.setModulos(modulos)
      store.setRolVeterinario()
      return
    }

    // Usuario normal: cargar sociedad activa via membresia
    const { data: memb } = await supabase
      .from('membresia')
      .select('activa, cat_rol(nombre), sociedad(id, nombre, activa)')
      .eq('usuario_id', userId)
      .eq('activa', true)
      .single()

    // PostgREST puede devolver cat_rol como objeto o array según la versión
    type SociedadRow = { id: string; nombre: string; activa: boolean }
    type CatRol = { nombre: string }
    const m = memb as { cat_rol?: CatRol | CatRol[] | null; sociedad?: SociedadRow | null } | null
    const catRol = Array.isArray(m?.cat_rol) ? m?.cat_rol[0] : m?.cat_rol

    // Esperar el check de acceso antes de marcar el perfil como cargado,
    // para que RequireModulo no redirija prematuramente.
    const modulos = await getMisAccesos().catch(() => ({}))
    store.setModulos(modulos)
    store.setSociedadActiva(
      m?.sociedad ?? null,
      catRol?.nombre ?? null
    )
    store.setLoading(false)
  } catch {
    // Asegurar que el spinner se desbloquea aunque falle la carga del perfil
    store.setPerfilCargado()
    store.setLoading(false)
  }
}

export function useAuth() {
  const store = useAuthStore()

  useEffect(() => {
    let supabase: ReturnType<typeof getSupabaseClient>
    try {
      supabase = getSupabaseClient()
    } catch {
      store.setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      store.setSession(data.session)
      if (data.session?.user?.id) {
        cargarPerfilProd(data.session.user.id, supabase)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      store.setSession(session)
      if (session?.user?.id) {
        cargarPerfilProd(session.user.id, supabase)
      }
      if (!session) store.clear()
    })

    return () => listener.subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = async (email: string, password: string) => {
    const supabase = getSupabaseClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    // el perfil se carga via onAuthStateChange — también aplica setRolVeterinario si corresponde
  }

  // Autoregistro público de veterinarios independientes (RegistroVeterinarioPage).
  // `rol_solicitado` en el metadata lo consume el trigger `handle_new_auth_user`
  // (migración `20260811160000_self_registro_vet`) para asignar rol y crear la
  // suscripción inicial. Devuelve `session` para que el caller decida si hay
  // sesión activa (confirmación de email desactivada) o hay que esperarla.
  const signUp = async (params: {
    email: string
    password: string
    nombre: string
    apellido: string
  }) => {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        data: {
          nombre: params.nombre,
          apellido: params.apellido,
          rol_solicitado: 'veterinario',
        },
      },
    })
    if (error) throw error
    return { session: data.session }
  }

  const signOut = async () => {
    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
    store.clear()
  }

  return {
    user: store.user,
    session: store.session,
    sociedadActiva: store.sociedadActiva,
    rol: store.rol,
    loading: store.loading,
    tieneModulo: (codigo: ModuloCodigo) => tieneAccesoModulo(store.rol, store.modulos, codigo),
    isAuthenticated: !!store.session,
    signIn,
    signUp,
    signOut,
  }
}
