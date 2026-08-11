import { getSupabaseClient } from '../lib/supabase'
import type { ModuloCodigo, AccesoModulo, Modulo } from '../types/modulo'

export interface UserAccesoModulo {
  id: string          // usuario_id
  membresiaId: string
  nombre: string
  apellido: string
  email: string
  rol: string
  tieneAcceso: boolean
}

export async function listarModulos(): Promise<Modulo[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('cat_modulo')
    .select('id, codigo, nombre, activo')
    .eq('activo', true)
    .order('nombre')
  if (error) throw error
  return (data ?? []) as Modulo[]
}

export async function getMisAccesos(): Promise<Partial<Record<ModuloCodigo, AccesoModulo>>> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('get_mis_accesos_modulo')
  if (error) throw error
  const result: Partial<Record<ModuloCodigo, AccesoModulo>> = {}
  for (const row of (data ?? []) as { modulo_codigo: string; org_habilitado: boolean; usuario_habilitado: boolean }[]) {
    result[row.modulo_codigo as ModuloCodigo] = { org: row.org_habilitado, usuario: row.usuario_habilitado }
  }
  return result
}

export async function toggleSociedadModulo(sociedadId: string, moduloCodigo: ModuloCodigo, valor: boolean): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('set_sociedad_modulo', {
    p_sociedad_id: sociedadId,
    p_modulo_codigo: moduloCodigo,
    p_habilitado: valor,
  })
  if (error) throw error
}

export async function toggleMembresiaModulo(membresiaId: string, moduloCodigo: ModuloCodigo, valor: boolean): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('set_membresia_modulo', {
    p_membresia_id: membresiaId,
    p_modulo_codigo: moduloCodigo,
    p_habilitado: valor,
  })
  if (error) throw error
}

export async function toggleUsuarioModulo(usuarioId: string, moduloCodigo: ModuloCodigo, valor: boolean): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc('set_usuario_modulo', {
    p_usuario_id: usuarioId,
    p_modulo_codigo: moduloCodigo,
    p_habilitado: valor,
  })
  if (error) throw error
}

/** Acceso por usuario a un módulo, para todos los miembros activos de una sociedad. */
export async function listarAccesoMembresiasPorModulo(sociedadId: string, moduloCodigo: ModuloCodigo): Promise<UserAccesoModulo[]> {
  const supabase = getSupabaseClient()

  const { data: modulo, error: errModulo } = await supabase
    .from('cat_modulo')
    .select('id')
    .eq('codigo', moduloCodigo)
    .single()
  if (errModulo) throw errModulo

  const { data: membresias, error: errMemb } = await supabase
    .from('membresia')
    .select('id, cat_rol(nombre), usuario!inner(id, nombre, apellido, email)')
    .eq('sociedad_id', sociedadId)
    .eq('activa', true)
  if (errMemb) throw errMemb

  const filas = (membresias ?? []) as unknown as {
    id: string
    usuario: { id: string; nombre: string; apellido: string; email: string }
    cat_rol: { nombre: string }
  }[]
  const membresiaIds = filas.map((m) => m.id)

  const { data: accesos, error: errAcc } = membresiaIds.length > 0
    ? await supabase
        .from('membresia_modulo')
        .select('membresia_id, habilitado')
        .eq('modulo_id', modulo.id)
        .in('membresia_id', membresiaIds)
    : { data: [] as { membresia_id: string; habilitado: boolean }[], error: null }
  if (errAcc) throw errAcc

  const habilitados = new Set((accesos ?? []).filter((a) => a.habilitado).map((a) => a.membresia_id))

  return filas.map((m) => ({
    id: m.usuario.id,
    membresiaId: m.id,
    nombre: m.usuario.nombre,
    apellido: m.usuario.apellido,
    email: m.usuario.email,
    rol: m.cat_rol.nombre,
    tieneAcceso: habilitados.has(m.id),
  }))
}
