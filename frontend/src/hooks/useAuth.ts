import { useEffect } from 'react'
import { getSupabaseClient } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { isMockMode, getMockUserId } from '../dev/mockMode'
import { getMockUser } from '../dev/mockUsers'
import { tieneAccesoCentroCria } from '../services/accesoCentroCriaService'

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
      store.setRolVeterinario()
      return
    }

    // Usuario normal: cargar sociedad activa via membresia
    const { data: memb } = await supabase
      .from('membresia')
      .select('activa, cat_rol(nombre), sociedad(id, nombre, activa, acceso_centro_cria)')
      .eq('usuario_id', userId)
      .eq('activa', true)
      .single()

    if (memb) {
      store.setSociedadActiva(
        (memb as any).sociedad,
        (memb as any).cat_rol?.nombre ?? null
      )
    }
    store.setLoading(false)
    tieneAccesoCentroCria(userId).then((v) => store.setAccesosCentroC(v)).catch(() => {})
  } catch {
    store.setLoading(false)
  }
}

export function useAuth() {
  const store = useAuthStore()

  useEffect(() => {
    if (isMockMode()) {
      const mockUser = getMockUser(getMockUserId())
      store.setSession({ user: { id: mockUser.id, email: mockUser.email } } as never)
      if (mockUser.rol === 'superadmin') {
        store.setRolSuperAdmin()
        return
      }
      if (mockUser.rol === 'veterinario') {
        store.setRolVeterinario()
        return
      }
      store.setSociedadActiva(mockUser.sociedad, mockUser.rol)
      tieneAccesoCentroCria(mockUser.id).then((v) => store.setAccesosCentroC(v))
      return
    }

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
    if (isMockMode()) {
      const mockUser = getMockUser(getMockUserId())
      store.setSession({ user: { id: mockUser.id, email: mockUser.email } } as never)
      if (mockUser.rol === 'superadmin') {
        store.setRolSuperAdmin()
        return
      }
      store.setSociedadActiva(mockUser.sociedad, mockUser.rol)
      return
    }
    const supabase = getSupabaseClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    // el perfil se carga via onAuthStateChange — también aplica setRolVeterinario si corresponde
  }

  const signOut = async () => {
    if (isMockMode()) { store.clear(); return }
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
    accesosCentroC: store.accesosCentroC,
    accesosCentroCOrg: store.accesosCentroCOrg,
    isMock: isMockMode(),
    isAuthenticated: !!store.session,
    signIn,
    signOut,
  }
}
