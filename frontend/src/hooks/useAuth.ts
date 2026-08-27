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

    // Usuario normal: cargar sociedad activa via membresia.
    // NO se usa `.single()`: un usuario puede tener más de una membresía activa
    // (otra sociedad, u otro rol en la misma — la tabla solo tiene
    // UNIQUE(usuario_id, sociedad_id, rol_id)), y ahí `.single()` tiraba y el
    // usuario quedaba sin sociedad, bloqueado. Hasta que exista un selector de
    // sociedad, se toma la membresía más antigua de forma determinista.
    const { data: membRows } = await supabase
      .from('membresia')
      .select('activa, created_at, cat_rol(nombre), sociedad(id, nombre, activa)')
      .eq('usuario_id', userId)
      .eq('activa', true)
      .order('created_at', { ascending: true })

    // PostgREST puede devolver cat_rol como objeto o array según la versión
    type SociedadRow = { id: string; nombre: string; activa: boolean }
    type CatRol = { nombre: string }
    const m = ((membRows ?? []) as unknown as { cat_rol?: CatRol | CatRol[] | null; sociedad?: SociedadRow | null }[])[0] ?? null
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

/**
 * Suscribe la app a los cambios de sesión de Supabase y dispara la carga del
 * perfil. Va montado UNA sola vez, en el componente raíz (`App`): antes vivía
 * dentro de `useAuth`, y como ese hook lo consumen ~40 componentes, cada uno
 * montaba su propio `onAuthStateChange` + `getSession()` y podían dispararse
 * varias `cargarPerfilProd` en paralelo en el arranque.
 */
export function useAuthListener() {
  useEffect(() => {
    const store = useAuthStore.getState()
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
  }, [])
}

export function useAuth() {
  const store = useAuthStore()

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
    /** Obligatorio: el trigger rechaza el alta de un vet sin DNI. */
    dni: string
    matricula?: string
  }) => {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        // Sin esto el link del mail de confirmación usa el Site URL global del
        // proyecto Supabase (que apunta a localhost). Con el origen actual, el
        // vet vuelve al mismo entorno donde se registró.
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          nombre: params.nombre,
          apellido: params.apellido,
          dni: params.dni,
          matricula: params.matricula ?? null,
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
