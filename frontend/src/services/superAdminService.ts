import { getSupabaseClient } from '../lib/supabase'
import * as moduloService from './moduloService'
import type { ModuloCodigo } from '../types/modulo'

export interface EmpresaStats {
  id: string
  nombre: string
  cantidadCaballos: number
  cantidadUsuarios: number
  cantidadCampos: number
  modulos: Partial<Record<ModuloCodigo, boolean>>
}

export interface UsuarioEmpresa {
  id: string          // membresiaId
  usuario_id: string
  nombre: string
  apellido: string
  email: string
  rol: string
  activo: boolean
  modulos: Partial<Record<ModuloCodigo, boolean>>
}

export interface NuevoUsuarioPayload {
  nombre: string
  apellido: string
  email: string
  password: string
  rol: string
  modulos: Partial<Record<ModuloCodigo, boolean>>
}

export interface VeterinarioAcceso {
  id: string
  nombre: string
  apellido: string
  email: string
  activo: boolean
  modulos: Partial<Record<ModuloCodigo, boolean>>
  caballosPropios: number
  suscripcionEstado: 'activa' | 'inactiva' | 'cancelada' | null
}

// ── Helper compartido: módulos habilitados por entidad, para las 3 tablas puente ──

async function modulosPorIds(
  tabla: 'sociedad_modulo' | 'membresia_modulo' | 'usuario_modulo',
  columnaId: 'sociedad_id' | 'membresia_id' | 'usuario_id',
  ids: string[],
): Promise<Map<string, Partial<Record<ModuloCodigo, boolean>>>> {
  const mapa = new Map<string, Partial<Record<ModuloCodigo, boolean>>>()
  if (ids.length === 0) return mapa

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from(tabla)
    .select(`${columnaId}, habilitado, cat_modulo(codigo)`)
    .in(columnaId, ids)
    .eq('habilitado', true)
  if (error) throw error

  for (const fila of (data ?? []) as unknown as Record<string, unknown>[]) {
    const entidadId = fila[columnaId] as string
    const codigo = (fila.cat_modulo as { codigo: ModuloCodigo } | null)?.codigo
    if (!codigo) continue
    const actuales = mapa.get(entidadId) ?? {}
    actuales[codigo] = true
    mapa.set(entidadId, actuales)
  }
  return mapa
}

/**
 * Invoca una Edge Function y propaga el mensaje de error real.
 *
 * `functions.invoke` colapsa cualquier respuesta no-2xx en un error genérico
 * ("Edge Function returned a non-2xx status code") y deja la respuesta original
 * en `context`. Sin desenvolverla, el detalle de por qué no se pudo eliminar un
 * usuario —que es toda la utilidad del mensaje— nunca llega a la pantalla.
 */
async function invocarFuncion(nombre: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.functions.invoke(nombre, { body })
  if (!error) return (data ?? {}) as Record<string, unknown>

  const respuesta = (error as { context?: unknown }).context
  if (respuesta instanceof Response) {
    const cuerpo = await respuesta.json().catch(() => null) as { error?: string } | null
    if (cuerpo?.error) throw new Error(cuerpo.error)
  }
  throw new Error(error.message)
}

// ── Servicio ──────────────────────────────────────────────────────────────────

export const superAdminService = {
  // ── Empresas ─────────────────────────────────────────────────────────────────

  async listarEmpresas(): Promise<EmpresaStats[]> {
    const supabase = getSupabaseClient()
    const { data: socs, error } = await supabase
      .from('sociedad')
      .select('id, nombre')
      .eq('activa', true)
      .order('nombre')
    if (error) throw error

    const modulosPorSociedad = await modulosPorIds('sociedad_modulo', 'sociedad_id', (socs ?? []).map((s) => s.id))

    const stats = await Promise.all((socs ?? []).map(async (soc) => {
      const [caballos, usuarios, campos] = await Promise.all([
        supabase.from('caballo').select('id', { count: 'exact', head: true }).eq('sociedad_id', soc.id).eq('activo', true),
        supabase.from('membresia').select('id', { count: 'exact', head: true }).eq('sociedad_id', soc.id).eq('activa', true),
        supabase.from('campo').select('id', { count: 'exact', head: true }).eq('sociedad_id', soc.id),
      ])
      return {
        id: soc.id,
        nombre: soc.nombre,
        cantidadCaballos: caballos.count ?? 0,
        cantidadUsuarios: usuarios.count ?? 0,
        cantidadCampos: campos.count ?? 0,
        modulos: modulosPorSociedad.get(soc.id) ?? {},
      }
    }))

    return stats
  },

  async crearEmpresa(nombre: string): Promise<EmpresaStats> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('sociedad')
      .insert({ nombre: nombre.trim(), activa: true })
      .select('id, nombre')
      .single()
    if (error) throw error
    return { id: data.id, nombre: data.nombre, cantidadCaballos: 0, cantidadUsuarios: 0, cantidadCampos: 0, modulos: {} }
  },

  async eliminarEmpresa(sociedadId: string): Promise<void> {
    const supabase = getSupabaseClient()
    // Soft delete: desactivar empresa y sus membresías
    await supabase.from('membresia').update({ activa: false }).eq('sociedad_id', sociedadId)
    const { error } = await supabase.from('sociedad').update({ activa: false }).eq('id', sociedadId)
    if (error) throw error
  },

  // ── Usuarios ─────────────────────────────────────────────────────────────────

  async listarUsuariosPorEmpresa(sociedadId: string): Promise<UsuarioEmpresa[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('membresia')
      .select(`
        id,
        activa,
        usuario_id,
        usuario!inner(nombre, apellido, email),
        cat_rol!inner(nombre)
      `)
      .eq('sociedad_id', sociedadId)
    if (error) throw error

    const filas = (data ?? []) as unknown as {
      id: string; usuario_id: string
      usuario: { nombre: string; apellido: string; email: string }
      cat_rol: { nombre: string }; activa: boolean
    }[]

    const modulosPorMembresia = await modulosPorIds('membresia_modulo', 'membresia_id', filas.map((m) => m.id))

    return filas.map((m) => ({
      id: m.id,
      usuario_id: m.usuario_id,
      nombre: m.usuario.nombre,
      apellido: m.usuario.apellido,
      email: m.usuario.email,
      rol: m.cat_rol.nombre,
      activo: m.activa,
      modulos: modulosPorMembresia.get(m.id) ?? {},
    }))
  },

  async crearUsuario(sociedadId: string, payload: NuevoUsuarioPayload): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase.functions.invoke('create-user', {
      body: {
        nombre: payload.nombre.trim(),
        apellido: payload.apellido.trim(),
        email: payload.email.trim(),
        password: payload.password,
        sociedad_id: sociedadId,
        rol: payload.rol,
        modulos: payload.modulos,
      },
    })
    if (error) throw new Error(error.message)
  },

  async eliminarUsuario(membresiaId: string): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('membresia').delete().eq('id', membresiaId)
    if (error) throw error
  },

  async cambiarRol(membresiaId: string, nuevoRol: string): Promise<void> {
    const supabase = getSupabaseClient()
    const { data: catRol, error: rolError } = await supabase
      .from('cat_rol')
      .select('id')
      .eq('nombre', nuevoRol)
      .single()
    if (rolError) throw rolError

    const { error } = await supabase
      .from('membresia')
      .update({ rol_id: catRol.id })
      .eq('id', membresiaId)
    if (error) throw error
  },

  async toggleActivo(membresiaId: string, valor: boolean): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('membresia')
      .update({ activa: valor })
      .eq('id', membresiaId)
    if (error) throw error
  },

  async toggleModuloOrg(sociedadId: string, codigo: ModuloCodigo, valor: boolean): Promise<void> {
    return moduloService.toggleSociedadModulo(sociedadId, codigo, valor)
  },

  async toggleModuloMembresia(membresiaId: string, codigo: ModuloCodigo, valor: boolean): Promise<void> {
    return moduloService.toggleMembresiaModulo(membresiaId, codigo, valor)
  },

  // ── Veterinarios ─────────────────────────────────────────────────────────────
  // Los veterinarios son usuarios globales (usuario.rol = 'veterinario'), sin
  // sociedad/membresía fija. El superadmin otorga/deniega su acceso a cada
  // módulo igual que con las empresas, pero a nivel de usuario.

  async listarVeterinarios(): Promise<VeterinarioAcceso[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('usuario')
      .select('id, nombre, apellido, email, activo')
      .eq('rol', 'veterinario')
      .order('nombre')
    if (error) throw error

    const filas = (data ?? []) as { id: string; nombre: string; apellido: string; email: string; activo: boolean }[]
    if (filas.length === 0) return []
    const vetIds = filas.map((u) => u.id)

    // El conteo usa la RPC `superadmin_caballos_propios_por_vet` en vez de una
    // query directa a `caballo`, para no duplicar en el cliente el predicado
    // de "caballo propio activo" que ya vive en `vet_caballos_propios` — esa
    // función quedó restringida a llamadas internas (`REVOKE ... FROM
    // authenticated`), así que esta RPC es la única fuente de verdad para el
    // superadmin.
    const [modulosPorUsuario, caballosRes, suscripcionesRes] = await Promise.all([
      modulosPorIds('usuario_modulo', 'usuario_id', vetIds),
      supabase.rpc('superadmin_caballos_propios_por_vet', { p_vet_ids: vetIds }),
      supabase.from('suscripcion_veterinario').select('usuario_id, estado').in('usuario_id', vetIds),
    ])
    if (caballosRes.error) throw caballosRes.error
    if (suscripcionesRes.error) throw suscripcionesRes.error

    const cantidadPorVet = new Map<string, number>()
    for (const c of (caballosRes.data ?? []) as { vet_owner_id: string; cantidad: number }[]) {
      cantidadPorVet.set(c.vet_owner_id, c.cantidad)
    }
    const estadoPorVet = new Map<string, VeterinarioAcceso['suscripcionEstado']>()
    for (const s of (suscripcionesRes.data ?? []) as { usuario_id: string; estado: VeterinarioAcceso['suscripcionEstado'] }[]) {
      estadoPorVet.set(s.usuario_id, s.estado)
    }

    return filas.map((u) => ({
      id: u.id,
      nombre: u.nombre,
      apellido: u.apellido,
      email: u.email,
      activo: u.activo,
      modulos: modulosPorUsuario.get(u.id) ?? {},
      caballosPropios: cantidadPorVet.get(u.id) ?? 0,
      suscripcionEstado: estadoPorVet.get(u.id) ?? null,
    }))
  },

  async toggleModuloUsuario(usuarioId: string, codigo: ModuloCodigo, valor: boolean): Promise<void> {
    return moduloService.toggleUsuarioModulo(usuarioId, codigo, valor)
  },

  async activarSuscripcionVeterinario(usuarioId: string): Promise<void> {
    const supabase = getSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('suscripcion_veterinario')
      .upsert({
        usuario_id: usuarioId,
        estado: 'activa',
        activado_por: user?.id ?? null,
        fecha_activacion: new Date().toISOString(),
        fecha_vencimiento: null,
      }, { onConflict: 'usuario_id' })
    if (error) throw error
  },

  async desactivarSuscripcionVeterinario(usuarioId: string): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('suscripcion_veterinario')
      .upsert({ usuario_id: usuarioId, estado: 'cancelada' }, { onConflict: 'usuario_id' })
    if (error) throw error
  },

  /**
   * Borra al veterinario de forma definitiva: sus caballos propios, su
   * suscripción (cancelándola antes en MercadoPago si estaba viva) y su login,
   * para que el email quede libre y pueda registrarse de cero.
   *
   * No es un soft delete y no hay vuelta atrás. Falla —sin borrar nada— si el
   * usuario dejó datos que no le pertenecen o que no pueden destruirse; el
   * mensaje enumera cuáles. El historial clínico entra siempre en esa
   * categoría: sobrevive al vet que lo escribió.
   */
  async eliminarVeterinarioDefinitivo(usuarioId: string): Promise<void> {
    await invocarFuncion('eliminar-usuario', { usuario_id: usuarioId })
  },

  // ── Helpers ───────────────────────────────────────────────────────────────────

  async getTodasEmpresas(): Promise<Array<{ id: string; nombre: string }>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('sociedad')
      .select('id, nombre')
      .eq('activa', true)
      .order('nombre')
    if (error) throw error
    return data ?? []
  },
}
