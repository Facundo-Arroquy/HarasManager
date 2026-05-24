import { isMockMode } from '../dev/mockMode'
import { MOCK_MEMBRESIAS, MOCK_CABALLOS, MOCK_CAMPOS, MOCK_SOCIEDADES } from '../dev/mockData'
import { MOCK_SOCIEDAD } from '../dev/mockUsers'
import { getSupabaseClient } from '../lib/supabase'

export interface EmpresaStats {
  id: string
  nombre: string
  cantidadCaballos: number
  cantidadUsuarios: number
  cantidadCampos: number
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

// ── Estado mutable mock ────────────────────────────────────────────────────────

let membresias = MOCK_MEMBRESIAS.map((m) => ({ ...m }))

let sociedades: Array<{ id: string; nombre: string }> = [
  { id: MOCK_SOCIEDAD.id, nombre: MOCK_SOCIEDAD.nombre },
  ...MOCK_SOCIEDADES,
]

// ── Servicio ──────────────────────────────────────────────────────────────────

export const superAdminService = {
  // ── Empresas ─────────────────────────────────────────────────────────────────

  async listarEmpresas(): Promise<EmpresaStats[]> {
    if (isMockMode()) {
      return sociedades.map((soc) => ({
        id: soc.id,
        nombre: soc.nombre,
        cantidadCaballos: MOCK_CABALLOS.filter((c) => c.sociedad_id === soc.id && c.activo).length,
        cantidadUsuarios: membresias.filter((m) => m.sociedad_id === soc.id).length,
        cantidadCampos: MOCK_CAMPOS.filter((c) => c.sociedad_id === soc.id).length,
      }))
    }

    const supabase = getSupabaseClient()
    const { data: socs, error } = await supabase
      .from('sociedad')
      .select('id, nombre')
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
      }
    }))

    return stats
  },

  async crearEmpresa(nombre: string): Promise<EmpresaStats> {
    if (isMockMode()) {
      const nueva = { id: `soc-${Date.now()}`, nombre: nombre.trim() }
      sociedades = [...sociedades, nueva]
      return { ...nueva, cantidadCaballos: 0, cantidadUsuarios: 0, cantidadCampos: 0 }
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('sociedad')
      .insert({ nombre: nombre.trim(), activa: true })
      .select('id, nombre')
      .single()
    if (error) throw error
    return { id: data.id, nombre: data.nombre, cantidadCaballos: 0, cantidadUsuarios: 0, cantidadCampos: 0 }
  },

  async eliminarEmpresa(sociedadId: string): Promise<void> {
    if (isMockMode()) {
      sociedades = sociedades.filter((s) => s.id !== sociedadId)
      membresias = membresias.filter((m) => m.sociedad_id !== sociedadId)
      return
    }

    const supabase = getSupabaseClient()
    // Soft delete: desactivar empresa y sus membresías
    await supabase.from('membresia').update({ activa: false }).eq('sociedad_id', sociedadId)
    const { error } = await supabase.from('sociedad').update({ activa: false }).eq('id', sociedadId)
    if (error) throw error
  },

  // ── Usuarios ─────────────────────────────────────────────────────────────────

  async listarUsuariosPorEmpresa(sociedadId: string): Promise<UsuarioEmpresa[]> {
    if (isMockMode()) {
      return membresias
        .filter((m) => m.sociedad_id === sociedadId)
        .map((m) => ({
          id: m.id,
          usuario_id: m.usuario_id,
          nombre: m.usuario.nombre,
          apellido: m.usuario.apellido,
          email: m.usuario.email,
          rol: m.rol,
          activo: m.activo,
          accesosCentroC: m.accesosCentroC,
        }))
    }

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

    return (data ?? []).map((m: any) => ({
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
    if (isMockMode()) {
      const id = `m-${Date.now()}`
      membresias = [
        ...membresias,
        {
          id,
          usuario_id: `usr-${Date.now()}`,
          sociedad_id: sociedadId,
          rol: payload.rol,
          activo: true,
          accesosCentroC: payload.accesosCentroC,
          usuario: {
            nombre: payload.nombre.trim(),
            apellido: payload.apellido.trim(),
            email: payload.email.trim(),
          },
        },
      ]
      return
    }

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
    if (isMockMode()) {
      membresias = membresias.filter((m) => m.id !== membresiaId)
      return
    }

    const supabase = getSupabaseClient()
    const { error } = await supabase.from('membresia').delete().eq('id', membresiaId)
    if (error) throw error
  },

  async cambiarRol(membresiaId: string, nuevoRol: string): Promise<void> {
    if (isMockMode()) {
      const m = membresias.find((x) => x.id === membresiaId)
      if (m) m.rol = nuevoRol
      return
    }

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
    if (isMockMode()) {
      const m = membresias.find((x) => x.id === membresiaId)
      if (m) m.accesosCentroC = valor
      return
    }

    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('membresia')
      .update({ acceso_centro_cria: valor })
      .eq('id', membresiaId)
    if (error) throw error
  },

  async toggleActivo(membresiaId: string, valor: boolean): Promise<void> {
    if (isMockMode()) {
      const m = membresias.find((x) => x.id === membresiaId)
      if (m) m.activo = valor
      return
    }

    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('membresia')
      .update({ activa: valor })
      .eq('id', membresiaId)
    if (error) throw error
  },

  // ── Helpers ───────────────────────────────────────────────────────────────────

  async getTodasEmpresas(): Promise<Array<{ id: string; nombre: string }>> {
    if (isMockMode()) {
      return [...sociedades]
    }

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
