import { MOCK_MEMBRESIAS, MOCK_CABALLOS, MOCK_CAMPOS, MOCK_SOCIEDADES } from '../dev/mockData'
import { MOCK_SOCIEDAD } from '../dev/mockUsers'

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

// ── Estado mutable en memoria (mock) ─────────────────────────────────────────

let membresias = MOCK_MEMBRESIAS.map((m) => ({ ...m }))

let sociedades: Array<{ id: string; nombre: string }> = [
  { id: MOCK_SOCIEDAD.id, nombre: MOCK_SOCIEDAD.nombre },
  ...MOCK_SOCIEDADES,
]

// ── Servicio ──────────────────────────────────────────────────────────────────

export const superAdminService = {
  // ── Empresas ────────────────────────────────────────────────────────────────

  listarEmpresas(): EmpresaStats[] {
    return sociedades.map((soc) => ({
      id: soc.id,
      nombre: soc.nombre,
      cantidadCaballos: MOCK_CABALLOS.filter((c) => c.sociedad_id === soc.id && c.activo).length,
      cantidadUsuarios: membresias.filter((m) => m.sociedad_id === soc.id).length,
      cantidadCampos: MOCK_CAMPOS.filter((c) => c.sociedad_id === soc.id).length,
    }))
  },

  crearEmpresa(nombre: string): EmpresaStats {
    const nueva = { id: `soc-${Date.now()}`, nombre: nombre.trim() }
    sociedades = [...sociedades, nueva]
    return { ...nueva, cantidadCaballos: 0, cantidadUsuarios: 0, cantidadCampos: 0 }
  },

  eliminarEmpresa(sociedadId: string): void {
    sociedades = sociedades.filter((s) => s.id !== sociedadId)
    membresias = membresias.filter((m) => m.sociedad_id !== sociedadId)
  },

  // ── Usuarios ─────────────────────────────────────────────────────────────────

  listarUsuariosPorEmpresa(sociedadId: string): UsuarioEmpresa[] {
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
  },

  crearUsuario(sociedadId: string, payload: NuevoUsuarioPayload): void {
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
  },

  eliminarUsuario(membresiaId: string): void {
    membresias = membresias.filter((m) => m.id !== membresiaId)
  },

  cambiarRol(membresiaId: string, nuevoRol: string): void {
    const m = membresias.find((x) => x.id === membresiaId)
    if (m) m.rol = nuevoRol
  },

  toggleAccesosCentroC(membresiaId: string, valor: boolean): void {
    const m = membresias.find((x) => x.id === membresiaId)
    if (m) m.accesosCentroC = valor
  },

  toggleActivo(membresiaId: string, valor: boolean): void {
    const m = membresias.find((x) => x.id === membresiaId)
    if (m) m.activo = valor
  },

  // ── Helpers ──────────────────────────────────────────────────────────────────

  getNombreEmpresa(sociedadId: string): string {
    return sociedades.find((s) => s.id === sociedadId)?.nombre ?? sociedadId
  },

  getTodasEmpresas() {
    return sociedades
  },

  tieneUsuarios(sociedadId: string): boolean {
    return membresias.some((m) => m.sociedad_id === sociedadId)
  },
}
