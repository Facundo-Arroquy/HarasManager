import { useAuth } from './useAuth'
import { NAV_GROUPS, type NavGroup } from '../components/layout/navItems'

/**
 * Filtro de NAV_GROUPS por rol + módulo, antes duplicado byte a byte en
 * Sidebar.tsx y MobileDrawer.tsx (y con una asimetría real contra el guard
 * de ruta — ver App.tsx RequireModulo). Única fuente de verdad.
 */
export function useVisibleNavGroups(): NavGroup[] {
  const { rol, tieneModulo } = useAuth()

  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.roles || (rol && item.roles.includes(rol))
    ),
  })).filter((group) => {
    if (group.items.length === 0) return false
    if (group.requiresModulo) return tieneModulo(group.requiresModulo)
    return true
  })
}
