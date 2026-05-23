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

// Estado mutable en memoria para el mock
let membresias = MOCK_MEMBRESIAS.map((m) => ({ ...m }))

const TODAS_SOCIEDADES = [
  { id: MOCK_SOCIEDAD.id, nombre: MOCK_SOCIEDAD.nombre },
  ...MOCK_SOCIEDADES,
]

export const superAdminService = {
  listarEmpresas(): EmpresaStats[] {
    return TODAS_SOCIEDADES.map((soc) => ({
      id: soc.id,
      nombre: soc.nombre,
      cantidadCaballos: MOCK_CABALLOS.filter((c) => c.sociedad_id === soc.id && c.activo).length,
      cantidadUsuarios: membresias.filter((m) => m.sociedad_id === soc.id).length,
      cantidadCampos: MOCK_CAMPOS.filter((c) => c.sociedad_id === soc.id).length,
    }))
  },

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

  getNombreEmpresa(sociedadId: string): string {
    return TODAS_SOCIEDADES.find((s) => s.id === sociedadId)?.nombre ?? sociedadId
  },

  getTodasEmpresas() {
    return TODAS_SOCIEDADES
  },
}
