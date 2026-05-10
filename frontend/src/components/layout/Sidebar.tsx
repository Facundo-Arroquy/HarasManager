import { NavLink } from 'react-router-dom'
import { LayoutDashboard, LayoutGrid, Settings, LogOut, Stethoscope, SlidersHorizontal } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  roles?: string[]   // undefined = visible para todos
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/dashboard',
    label: 'Panel',
    icon: <LayoutDashboard size={18} />,
  },
  {
    to: '/caballos',
    label: 'Caballos',
    icon: <LayoutGrid size={18} />,
  },
  {
    to: '/admin',
    label: 'Administración',
    icon: <Settings size={18} />,
    roles: ['admin'],
  },
  {
    to: '/config',
    label: 'Configuración',
    icon: <SlidersHorizontal size={18} />,
    roles: ['admin', 'jugador', 'piloto'],
  },
]

export default function Sidebar() {
  const { rol, sociedadActiva, user, signOut } = useAuth()

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (rol && item.roles.includes(rol))
  )

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-zinc-800 bg-zinc-950">
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

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-zinc-800 text-zinc-100 font-medium'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
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
