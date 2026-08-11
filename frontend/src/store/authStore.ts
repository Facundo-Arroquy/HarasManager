import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import type { ModuloCodigo, AccesoModulo } from '../types/modulo'

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
  perfilCargado: boolean        // true cuando cargarPerfilProd terminó (éxito o error)
  modulos: Partial<Record<ModuloCodigo, AccesoModulo>>
  setSession: (session: Session | null) => void
  setSociedadActiva: (sociedad: Sociedad | null, rol: string | null) => void
  setRolSuperAdmin: () => void
  setRolVeterinario: () => void
  setPerfilCargado: () => void
  setLoading: (v: boolean) => void
  setModulos: (modulos: Partial<Record<ModuloCodigo, AccesoModulo>>) => void
  setModuloUsuario: (codigo: ModuloCodigo, valor: boolean) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  sociedadActiva: null,
  rol: null,
  loading: true,
  perfilCargado: false,
  modulos: {},

  setSession: (session) =>
    set({ session, user: session?.user ?? null, loading: false }),

  setSociedadActiva: (sociedad, rol) =>
    set({
      sociedadActiva: sociedad,
      rol,
      perfilCargado: true,
    }),

  setRolSuperAdmin: () =>
    set({ rol: 'superadmin', sociedadActiva: null, loading: false, perfilCargado: true }),

  setRolVeterinario: () =>
    set({ rol: 'veterinario', sociedadActiva: null, loading: false, perfilCargado: true }),

  setPerfilCargado: () => set({ perfilCargado: true }),

  setLoading: (v) => set({ loading: v }),

  setModulos: (modulos) => set({ modulos }),

  setModuloUsuario: (codigo, valor) =>
    set((s) => ({
      modulos: { ...s.modulos, [codigo]: { org: s.modulos[codigo]?.org ?? false, usuario: valor } },
    })),

  clear: () =>
    set({
      user: null,
      session: null,
      sociedadActiva: null,
      rol: null,
      loading: false,
      perfilCargado: false,
      modulos: {},
    }),
}))
