import { isMockMode } from '../dev/mockMode'
import { MOCK_USERS } from '../dev/mockUsers'
import { MOCK_MARCAS, MOCK_CABALLOS, MOCK_ACCESOS_VET } from '../dev/mockData'
import { getSupabaseClient } from '../lib/supabase'

export interface UsuarioAdmin {
  id: string
  nombre: string
  apellido: string
  email: string
  telefono?: string
  rol: string
  marcaId: string | null
  activo: boolean
}

export interface MarcaAdmin {
  id: string
  nombre: string
  dominio_email: string
  activa: boolean
  caballos_count: number
}

export interface AccesoVet {
  id: string
  vet_id: string
  vet: { nombre: string; apellido: string; email: string }
  marca_id: string | null
  marca: { nombre: string } | null
  caballo_id: string | null
  caballo: { nombre: string } | null
  activo: boolean
}

export interface NuevoAccesoPayload {
  vet_id: string
  tipo: 'masivo' | 'individual'
  marca_id?: string
  caballo_id?: string
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
      marcaId: u.marcaId,
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
    marcaId: null,
    activo: m.usuario.activo,
  }))
}

// ── Marcas ────────────────────────────────────────────────────────────────────

export async function getMarcas(sociedadId: string): Promise<MarcaAdmin[]> {
  if (isMockMode()) {
    return MOCK_MARCAS.map((m) => ({
      id: m.id,
      nombre: m.nombre,
      dominio_email: m.dominio_email,
      activa: m.activa,
      caballos_count: MOCK_CABALLOS.filter((c) => c.marca_id === m.id).length,
    }))
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('marca')
    .select('id, nombre, dominio_email, activa')
    .eq('sociedad_id', sociedadId)
    .order('nombre')
  if (error) throw error

  // Contar caballos por marca
  const marcas: MarcaAdmin[] = await Promise.all(
    (data ?? []).map(async (m: any) => {
      const { count } = await supabase
        .from('caballo')
        .select('*', { count: 'exact', head: true })
        .eq('marca_id', m.id)
        .eq('activo', true)
      return { ...m, caballos_count: count ?? 0 }
    })
  )
  return marcas
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
      id, vet_id, marca_id, caballo_id, activo,
      usuario:vet_id(nombre, apellido, email),
      marca(nombre),
      caballo(nombre)
    `)
    .eq('activo', true)
  if (error) throw error

  return (data ?? []).map((a: any) => ({
    id: a.id,
    vet_id: a.vet_id,
    vet: a.usuario,
    marca_id: a.marca_id,
    marca: a.marca,
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

    const marca = payload.marca_id
      ? MOCK_MARCAS.find((m) => m.id === payload.marca_id) ?? null
      : null
    const caballo = payload.caballo_id
      ? MOCK_CABALLOS.find((c) => c.id === payload.caballo_id) ?? null
      : null

    MOCK_ACCESOS_VET.push({
      id: `av-${Date.now()}`,
      vet_id: vet.id,
      vet: { nombre: vet.nombre, apellido: vet.apellido, email: vet.email },
      marca_id: payload.marca_id ?? null,
      marca: marca ? { nombre: marca.nombre } : null,
      caballo_id: payload.caballo_id ?? null,
      caballo: caballo ? { nombre: caballo.nombre } : null,
      activo: true,
      otorgado_por: otorgadoPor,
    })
    return
  }

  const supabase = getSupabaseClient()
  const { error } = await supabase.from('acceso_veterinario').insert({
    vet_id: payload.vet_id,
    marca_id: payload.tipo === 'masivo' ? payload.marca_id : null,
    caballo_id: payload.tipo === 'individual' ? payload.caballo_id : null,
    otorgado_por: otorgadoPor,
    activo: true,
  })
  if (error) throw error
}
