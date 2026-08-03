import { getSupabaseClient } from '../lib/supabase'

export interface UserAccesoCentro {
  id: string
  nombre: string
  apellido: string
  email: string
  rol: string
  tieneAcceso: boolean
}

export async function tieneAccesoCentroCria(userId: string): Promise<boolean> {
  // Supabase: lee la columna acceso_centro_cria de membresia
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('membresia')
    .select('acceso_centro_cria')
    .eq('usuario_id', userId)
    .eq('activa', true)
    .maybeSingle()
  return data?.acceso_centro_cria ?? false
}

// Veterinarios son usuarios globales sin membresía — su acceso al Centro de
// Embriones lo otorga/deniega el superadmin directamente sobre usuario.acceso_centro_cria
export async function tieneAccesoCentroCriaVeterinario(userId: string): Promise<boolean> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('usuario')
    .select('acceso_centro_cria')
    .eq('id', userId)
    .maybeSingle()
  return data?.acceso_centro_cria ?? false
}

export async function listarAccesosCentroCria(sociedadId: string): Promise<UserAccesoCentro[]> {
  // Supabase: misma tabla membresia con el campo acceso_centro_cria
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membresia')
    .select(`
      acceso_centro_cria,
      cat_rol(nombre),
      usuario!inner(id, nombre, apellido, email)
    `)
    .eq('sociedad_id', sociedadId)
    .eq('activa', true)
  if (error) throw error
  return ((data ?? []) as unknown as {
    usuario: { id: string; nombre: string; apellido: string; email: string }
    cat_rol: { nombre: string }; acceso_centro_cria?: boolean | null
  }[]).map((m) => ({
    id: m.usuario.id,
    nombre: m.usuario.nombre,
    apellido: m.usuario.apellido,
    email: m.usuario.email,
    rol: m.cat_rol.nombre,
    tieneAcceso: m.acceso_centro_cria ?? false,
  }))
}

export async function actualizarAccesoCentroCria(
  userId: string,
  tieneAcceso: boolean,
  sociedadId?: string
): Promise<void> {
  // Supabase: actualiza columna acceso_centro_cria en membresia
  const supabase = getSupabaseClient()
  let q = supabase
    .from('membresia')
    .update({ acceso_centro_cria: tieneAcceso })
    .eq('usuario_id', userId)
    .eq('activa', true)
  if (sociedadId) q = q.eq('sociedad_id', sociedadId)
  const { error } = await q
  if (error) throw error
}
