import { isMockMode } from '../dev/mockMode'
import { MOCK_USERS } from '../dev/mockUsers'
import { MOCK_CABALLOS, MOCK_ACCESOS_VET } from '../dev/mockData'
import { getSupabaseClient } from '../lib/supabase'

export interface VeterinarioPlataforma {
  id: string
  nombre: string
  apellido: string
  email: string
}

export async function getVeterinariosPlataforma(): Promise<VeterinarioPlataforma[]> {
  if (isMockMode()) {
    return MOCK_USERS
      .filter((u) => u.rol === 'veterinario')
      .map((u) => ({ id: u.id, nombre: u.nombre, apellido: u.apellido, email: u.email }))
  }

  const supabase = getSupabaseClient()
  // Usamos RPC con SECURITY DEFINER para bypasear RLS — los vets no tienen
  // membresía en la org del admin, por lo que una query directa devolvería vacío
  const { data, error } = await supabase.rpc('get_veterinarios_plataforma')
  if (error) throw error
  return (data ?? []) as VeterinarioPlataforma[]
}

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
  caballo: { nombre: string; numero_registro?: string; fecha_nacimiento?: string } | null
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
      cat_rol!rol_id(nombre),
      usuario!inner(id, nombre, apellido, email, telefono, activo)
    `)
    .eq('sociedad_id', _sociedadId)
    .eq('activa', true)
  if (error) throw error

  return (data ?? []).map((m: any) => {
    // cat_rol puede venir como objeto o array según la versión de PostgREST
    const catRol = Array.isArray(m.cat_rol) ? m.cat_rol[0] : m.cat_rol
    return {
      id: m.usuario.id,
      nombre: m.usuario.nombre,
      apellido: m.usuario.apellido,
      email: m.usuario.email,
      telefono: m.usuario.telefono,
      rol: catRol?.nombre ?? '',
      activo: m.usuario.activo,
    }
  }).filter((u) => u.rol !== '')
}

// ── Accesos veterinario ───────────────────────────────────────────────────────

export async function getAccesosVet(_sociedadId: string): Promise<AccesoVet[]> {
  if (isMockMode()) {
    return MOCK_ACCESOS_VET.filter((a) => a.activo).map((a) => {
      const cab = MOCK_CABALLOS.find((c) => c.id === a.caballo_id)
      return {
        ...a,
        caballo: cab
          ? { nombre: cab.nombre, numero_registro: cab.numero_registro, fecha_nacimiento: cab.fecha_nacimiento }
          : a.caballo,
      }
    })
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('acceso_vet')
    .select(`
      id, vet_id, caballo_id, activo,
      usuario:vet_id(nombre, apellido, email),
      caballo(nombre, numero_registro, fecha_nacimiento)
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
    .from('acceso_vet')
    .update({ activo: false })
    .eq('id', accesoId)
  if (error) throw error
}

export async function revocarAccesosBulk(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => revocarAcceso(id)))
}

export async function otorgarAccesosBulk(
  vetId: string,
  caballoIds: string[],
  otorgadoPor: string
): Promise<void> {
  await Promise.all(caballoIds.map((id) => otorgarAcceso({ vet_id: vetId, caballo_id: id }, otorgadoPor)))
}

export async function otorgarAcceso(
  payload: NuevoAccesoPayload,
  otorgadoPor: string
): Promise<void> {
  if (isMockMode()) {
    const vet = MOCK_USERS.find((u) => u.id === payload.vet_id)
    if (!vet) return
    // Evitar duplicados: si ya existe un acceso activo para este vet+caballo, no crear otro
    const yaExiste = MOCK_ACCESOS_VET.some(
      (a) => a.vet_id === payload.vet_id && a.caballo_id === payload.caballo_id && a.activo
    )
    if (yaExiste) return
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
  const { error } = await supabase.from('acceso_vet').upsert({
    vet_id: payload.vet_id,
    caballo_id: payload.caballo_id,
    otorgado_por: otorgadoPor,
    activo: true,
  }, { onConflict: 'vet_id,caballo_id' })
  if (error) throw error
}
