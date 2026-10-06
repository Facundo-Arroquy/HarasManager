import type { ModuloCodigo, AccesoModulo } from '../types/modulo'

/**
 * Única fuente de verdad para "¿este usuario ve/entra a este módulo?".
 * La usan sidebar, drawer y el guard de ruta por igual — antes vivía
 * duplicada (y con una asimetría AND/OR real) en cada lugar por separado.
 */
export function tieneAccesoModulo(
  rol: string | null,
  modulos: Partial<Record<ModuloCodigo, AccesoModulo>>,
  codigo: ModuloCodigo,
): boolean {
  const acceso = modulos[codigo]
  if (!acceso) return false
  if (rol === 'veterinario') return acceso.usuario
  // Polo es parte operativa del rol piloto: alcanza con que la organización
  // tenga el módulo habilitado, igual que para el admin.
  if (codigo === 'polo' && rol === 'piloto') return acceso.org
  return acceso.org && (rol === 'admin' || acceso.usuario)
}
