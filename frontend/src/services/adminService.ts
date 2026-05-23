import { isMockMode } from '../dev/mockMode'
import { MOCK_USERS } from '../dev/mockUsers'
import { MOCK_CABALLOS, MOCK_ACCESOS_VET } from '../dev/mockData'
import { getSupabaseClient } from '../lib/supabase'

export interface UsuarioAdmin {
  id: string
  nombre: string
  apellido: string
  email: string
  telefono?: string
  rol: string
  activo: boolean
}

export interface AccesoVet {
  id: string
  vet_id: string
  vet: { nombre: string; apellido: string; email: string }
  caballo_id: string | null
  caballo: { nombre: string } | null
  activo: boolean
}

export interface NuevoAccesoPayload {
  vet_id: string
  caballo_id: string
}

// ── Usuarios ─────────────────────────────────────────────────────────────────

export async function getUsuarios(_sociedadId: string): Promise<UsuarioAdmin[]> {
  if (isMockMode()) {
    return MOCK_USERS.map((u) => ({
      id: u.id,
      nombre: u.nombre,
      apellido: u.apellido,
      email: u.email,
      telefono: u.telefono,
      rol: u.rol,
      activo: true,
    }))
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membresia')
    .select(`
      activa,
      cat_rol(nombre),
      usuario!inner(id, nombre, apellido, email, telefono, activo)
    `)
    .eq('sociedad_id', _sociedadId)
    .eq('activa', true)
  if (error) throw error

  return (data ?? []).map((m: any) => ({
    id: m.usuario.id,
    nombre: m.usuario.nombre,
    apellido: m.usuario.apellido,
    email: m.usuario.email,
    telefono: m.usuario.telefono,
    rol: m.cat_rol.nombre,
    activo: m.usuario.activo,
  }))
}

// ── Accesos veterinario ───────────────────────────────────────────────────────

export async function getAccesosVet(_sociedadId: string): Promise<AccesoVet[]> {
  if (isMockMode()) {
    return MOCK_ACCESOS_VET.filter((a) => a.activo)
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('acceso_veterinario')
    .select(`
      id, vet_id, caballo_id, activo,
      usuario:vet_id(nombre, apellido, email),
      caballo(nombre)
    `)
    .eq('activo', true)
  if (error) throw error

  return (data ?? []).map((a: any) => ({
    id: a.id,
    vet_id: a.vet_id,
    vet: a.usuario,
    caballo_id: a.caballo_id,
    caballo: a.caballo,
    activo: a.activo,
  }))
}

export async function revocarAcceso(accesoId: string): Promise<void> {
  if (isMockMode()) {
    const a = MOCK_ACCESOS_VET.find((x) => x.id === accesoId)
    if (a) a.activo = false
    return
  }

  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('acceso_veterinario')
    .update({ activo: false })
    .eq('id', accesoId)
  if (error) throw error
}

export async function otorgarAcceso(
  payload: NuevoAccesoPayload,
  otorgadoPor: string
): Promise<void> {
  if (isMockMode()) {
    const vet = MOCK_USERS.find((u) => u.id === payload.vet_id)
    if (!vet) return
    const caballo = MOCK_CABALLOS.find((c) => c.id === payload.caballo_id) ?? null

    MOCK_ACCESOS_VET.push({
      id: `av-${Date.now()}`,
      vet_id: vet.id,
      vet: { nombre: vet.nombre, apellido: vet.apellido, email: vet.email },
      caballo_id: payload.caballo_id,
      caballo: caballo ? { nombre: caballo.nombre } : null,
      activo: true,
      otorgado_por: otorgadoPor,
    })
    return
  }

  const supabase = getSupabaseClient()
  const { error } = await supabase.from('acceso_veterinario').insert({
    vet_id: payload.vet_id,
    caballo_id: payload.caballo_id,
    otorgado_por: otorgadoPor,
    activo: true,
  })
  if (error) throw error
}
