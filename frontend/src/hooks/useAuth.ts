import { useEffect } from 'react'
import { getSupabaseClient } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { isMockMode, getMockUserId } from '../dev/mockMode'
import { getMockUser } from '../dev/mockUsers'

export function useAuth() {
  const store = useAuthStore()

  useEffect(() => {
    if (isMockMode()) {
      // En mock mode seteamos la sesión del usuario simulado
      // pero NO lo hacemos aquí — el LoginPage decide cuándo redirigir.
      // Solo pre-cargamos si ya hay sesión activa (carga inicial desde otras páginas).
      const mockUser = getMockUser(getMockUserId())
      store.setSession({ user: { id: mockUser.id, email: mockUser.email } } as never)
      store.setSociedadActiva(mockUser.sociedad, mockUser.rol, mockUser.marcaId)
      return
    }

    // Modo producción: intentar conectar con Supabase
    let supabase: ReturnType<typeof getSupabaseClient>
    try {
      supabase = getSupabaseClient()
    } catch {
      // Env vars no configuradas — marcar loading como false sin crashear
      store.setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      store.setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      store.setSession(session)
      if (!session) store.clear()
    })

    return () => listener.subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = async (email: string, password: string) => {
    if (isMockMode()) {
      // En mock mode, cualquier credencial inicia sesión con el mock user activo
      const mockUser = getMockUser(getMockUserId())
      store.setSession({ user: { id: mockUser.id, email: mockUser.email } } as never)
      store.setSociedadActiva(mockUser.sociedad, mockUser.rol, mockUser.marcaId)
      return
    }
    const supabase = getSupabaseClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
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
    marcaId: store.marcaId,
    loading: store.loading,
    isMock: isMockMode(),
    isAuthenticated: !!store.session,
    signIn,
    signOut,
  }
}
