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
  marcaId: string | null   // null = admin haras o vet (sin marca propia)
  loading: boolean
  setSession: (session: Session | null) => void
  setSociedadActiva: (sociedad: Sociedad | null, rol: string | null, marcaId?: string | null) => void
  setLoading: (v: boolean) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  sociedadActiva: null,
  rol: null,
  marcaId: null,
  loading: true,

  setSession: (session) =>
    set({ session, user: session?.user ?? null, loading: false }),

  setSociedadActiva: (sociedad, rol, marcaId = null) =>
    set({ sociedadActiva: sociedad, rol, marcaId }),

  setLoading: (v) => set({ loading: v }),

  clear: () =>
    set({ user: null, session: null, sociedadActiva: null, rol: null, marcaId: null, loading: false }),
}))
