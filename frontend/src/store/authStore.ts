import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'

interface Sociedad {
  id: string
  nombre: string
  activa: boolean
  acceso_centro_cria?: boolean
}

interface AuthState {
  user: User | null
  session: Session | null
  sociedadActiva: Sociedad | null
  rol: string | null
  loading: boolean
  perfilCargado: boolean        // true cuando cargarPerfilProd terminó (éxito o error)
  accesosCentroC: boolean      // nivel usuario (membresia.acceso_centro_cria)
  accesosCentroCOrg: boolean   // nivel organización (sociedad.acceso_centro_cria)
  setSession: (session: Session | null) => void
  setSociedadActiva: (sociedad: Sociedad | null, rol: string | null) => void
  setRolSuperAdmin: () => void
  setRolVeterinario: () => void
  setPerfilCargado: () => void
  setLoading: (v: boolean) => void
  setAccesosCentroC: (v: boolean) => void
  setAccesosCentroCOrg: (v: boolean) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  sociedadActiva: null,
  rol: null,
  loading: true,
  perfilCargado: false,
  accesosCentroC: false,
  accesosCentroCOrg: false,

  setSession: (session) =>
    set({ session, user: session?.user ?? null, loading: false }),

  setSociedadActiva: (sociedad, rol) =>
    set({
      sociedadActiva: sociedad,
      rol,
      perfilCargado: true,
      accesosCentroCOrg: sociedad?.acceso_centro_cria ?? false,
    }),

  setRolSuperAdmin: () =>
    set({ rol: 'superadmin', sociedadActiva: null, loading: false, perfilCargado: true }),

  setRolVeterinario: () =>
    set({ rol: 'veterinario', sociedadActiva: null, loading: false, perfilCargado: true }),

  setPerfilCargado: () => set({ perfilCargado: true }),

  setLoading: (v) => set({ loading: v }),

  setAccesosCentroC: (v) => set({ accesosCentroC: v }),

  setAccesosCentroCOrg: (v) => set({ accesosCentroCOrg: v }),

  clear: () =>
    set({
      user: null,
      session: null,
      sociedadActiva: null,
      rol: null,
      loading: false,
      perfilCargado: false,
      accesosCentroC: false,
      accesosCentroCOrg: false,
    }),
}))
