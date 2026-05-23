import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'

interface Sociedad {
  id: string
  nombre: string
  activa: boolean
}

interface AuthState {
  user: User | null
  session: Session | null
  sociedadActiva: Sociedad | null
  rol: string | null
  loading: boolean
  setSession: (session: Session | null) => void
  setSociedadActiva: (sociedad: Sociedad | null, rol: string | null) => void
  setLoading: (v: boolean) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  sociedadActiva: null,
  rol: null,
  loading: true,

  setSession: (session) =>
    set({ session, user: session?.user ?? null, loading: false }),

  setSociedadActiva: (sociedad, rol) =>
    set({ sociedadActiva: sociedad, rol }),

  setLoading: (v) => set({ loading: v }),

  clear: () =>
    set({ user: null, session: null, sociedadActiva: null, rol: null, loading: false }),
}))
