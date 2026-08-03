import { getSupabaseClient } from '../lib/supabase'

export interface EmpresaStats {
  id: string
  nombre: string
  cantidadCaballos: number
  cantidadUsuarios: number
  cantidadCampos: number
  accesosCentroC: boolean
}

export interface UsuarioEmpresa {
  id: string          // membresiaId
  usuario_id: string
  nombre: string
  apellido: string
  email: string
  rol: string
  activo: boolean
  accesosCentroC: boolean
}

export interface NuevoUsuarioPayload {
  nombre: string
  apellido: string
  email: string
  password: string
  rol: string
  accesosCentroC: boolean
}

export interface VeterinarioAcceso {
  id: string
  nombre: string
  apellido: string
  email: string
  activo: boolean
  accesoCentroC: boolean
}

// ── Servicio ──────────────────────────────────────────────────────────────────

export const superAdminService = {
  // ── Empresas ─────────────────────────────────────────────────────────────────

  async listarEmpresas(): Promise<EmpresaStats[]> {
    const supabase = getSupabaseClient()
    const { data: socs, error } = await supabase
      .from('sociedad')
      .select('id, nombre, acceso_centro_cria')
      .eq('activa', true)
      .order('nombre')
    if (error) throw error

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
        accesosCentroC: soc.acceso_centro_cria ?? false,
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
    return { id: data.id, nombre: data.nombre, cantidadCaballos: 0, cantidadUsuarios: 0, cantidadCampos: 0, accesosCentroC: false }
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
        acceso_centro_cria,
        usuario_id,
        usuario!inner(nombre, apellido, email),
        cat_rol!inner(nombre)
      `)
      .eq('sociedad_id', sociedadId)
    if (error) throw error

    return ((data ?? []) as unknown as {
      id: string; usuario_id: string
      usuario: { nombre: string; apellido: string; email: string }
      cat_rol: { nombre: string }; activa: boolean; acceso_centro_cria?: boolean | null
    }[]).map((m) => ({
      id: m.id,
      usuario_id: m.usuario_id,
      nombre: m.usuario.nombre,
      apellido: m.usuario.apellido,
      email: m.usuario.email,
      rol: m.cat_rol.nombre,
      activo: m.activa,
      accesosCentroC: m.acceso_centro_cria ?? false,
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
        acceso_centro_cria: payload.accesosCentroC,
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

  async toggleAccesosCentroC(membresiaId: string, valor: boolean): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('membresia')
      .update({ acceso_centro_cria: valor })
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

  async toggleAccesoCentroCOrg(sociedadId: string, valor: boolean): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('sociedad')
      .update({ acceso_centro_cria: valor })
      .eq('id', sociedadId)
    if (error) throw error
  },

  // ── Veterinarios ─────────────────────────────────────────────────────────────
  // Los veterinarios son usuarios globales (usuario.rol = 'veterinario'), sin
  // sociedad/membresía fija. El superadmin otorga/deniega su acceso al Centro
  // de Embriones igual que con las empresas, pero a nivel de usuario.

  async listarVeterinarios(): Promise<VeterinarioAcceso[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('usuario')
      .select('id, nombre, apellido, email, activo, acceso_centro_cria')
      .eq('rol', 'veterinario')
      .order('nombre')
    if (error) throw error

    return ((data ?? []) as unknown as {
      id: string; nombre: string; apellido: string; email: string
      activo: boolean; acceso_centro_cria?: boolean | null
    }[]).map((u) => ({
      id: u.id,
      nombre: u.nombre,
      apellido: u.apellido,
      email: u.email,
      activo: u.activo,
      accesoCentroC: u.acceso_centro_cria ?? false,
    }))
  },

  async toggleAccesoCentroCVeterinario(usuarioId: string, valor: boolean): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('usuario')
      .update({ acceso_centro_cria: valor })
      .eq('id', usuarioId)
    if (error) throw error
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
