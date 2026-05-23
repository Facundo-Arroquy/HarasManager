import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, LayoutGrid, Settings, LogOut, Stethoscope,
  SlidersHorizontal, ClipboardList, Droplets, Bell, ArrowLeftRight, FlaskConical, CalendarDays,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  roles?: string[]
}

interface NavGroup {
  label: string
  roles?: string[]
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'General',
    items: [
      { to: '/dashboard',         label: 'Panel',              icon: <LayoutDashboard size={15} /> },
      { to: '/caballos',          label: 'Caballos',           icon: <LayoutGrid size={15} /> },
      { to: '/revision-preventa', label: 'Revisión pre-venta', icon: <ClipboardList size={15} />, roles: ['veterinario'] },
      { to: '/transferencias',    label: 'Transferencias',     icon: <ArrowLeftRight size={15} />, roles: ['admin'] },
      { to: '/admin',             label: 'Administración',     icon: <Settings size={15} />,      roles: ['admin'] },
      { to: '/config',            label: 'Configuración',      icon: <SlidersHorizontal size={15} />, roles: ['admin', 'jugador', 'piloto'] },
    ],
  },
  {
    label: 'Centro de Embriones',
    roles: ['veterinario', 'admin'],
    items: [
      { to: '/centro-cria',               label: 'Panel reproductivo', icon: <FlaskConical size={15} /> },
      { to: '/centro-cria/programa',      label: 'Programa semanal',   icon: <CalendarDays size={15} /> },
      { to: '/centro-cria/recordatorios', label: 'Recordatorios',      icon: <Bell size={15} /> },
      { to: '/centro-cria/flushings',     label: 'Flushings',          icon: <Droplets size={15} /> },
      { to: '/centro-cria/transferencias',label: 'Transferencias',     icon: <ArrowLeftRight size={15} /> },
    ],
  },
]

export default function Sidebar() {
  const { rol, sociedadActiva, user, signOut } = useAuth()
  const location = useLocation()

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.roles || (rol && item.roles.includes(rol))
    ),
  })).filter(
    (group) =>
      group.items.length > 0 &&
      (!group.roles || (rol && group.roles.includes(rol)))
  )

  return (
    <aside className="hidden md:flex h-screen w-56 flex-col border-r border-zinc-800 bg-zinc-950">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-zinc-800">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600">
          <Stethoscope size={14} className="text-white" />
        </div>
        <span className="text-sm font-semibold text-zinc-100 leading-tight">
          HarasManager
        </span>
      </div>

      {/* Sociedad activa */}
      {sociedadActiva && (
        <div className="px-4 py-3 border-b border-zinc-800">
          <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-0.5">
            Establecimiento
          </p>
          <p className="text-xs text-zinc-300 font-medium truncate">
            {sociedadActiva.nombre}
          </p>
        </div>
      )}

      {/* Navegación por grupos */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-[10px] font-medium uppercase tracking-widest text-zinc-600">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                // Para /centro-cria solo marcar activo si es exactamente esa ruta
                const isActive = item.to === '/centro-cria'
                  ? location.pathname === '/centro-cria'
                  : location.pathname.startsWith(item.to)
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                      isActive
                        ? 'bg-zinc-800 text-zinc-100 font-medium'
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Usuario + logout */}
      <div className="border-t border-zinc-800 p-3 space-y-2">
        <div className="px-1">
          <p className="text-xs font-medium text-zinc-300 truncate">
            {user?.email ?? '—'}
          </p>
          <p className="text-[11px] text-zinc-500 capitalize">{rol ?? '—'}</p>
        </div>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300 transition-colors"
        >
          <LogOut size={14} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
