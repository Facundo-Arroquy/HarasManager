import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  LayoutGrid,
  ClipboardList,
  Settings,
  SlidersHorizontal,
  LogOut,
  FlaskConical,
  ArrowLeftRight,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  roles?: string[]
  matchPrefix?: boolean
  requiresAccesoCentro?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard',         label: 'Inicio',   icon: <LayoutDashboard size={22} /> },
  { to: '/caballos',          label: 'Caballos', icon: <LayoutGrid size={22} /> },
  { to: '/revision-preventa', label: 'Revisión', icon: <ClipboardList size={22} />,   roles: ['veterinario'] },
  { to: '/admin',             label: 'Admin',    icon: <Settings size={22} />,         roles: ['admin'] },
  { to: '/config',            label: 'Config',   icon: <SlidersHorizontal size={22} />, roles: ['jugador', 'piloto'] },
  { to: '/centro-cria',       label: 'Cría',     icon: <FlaskConical size={22} />,    matchPrefix: true, requiresAccesoCentro: true },
  { to: '/transferencias',    label: 'Transferir', icon: <ArrowLeftRight size={22} />, roles: ['admin'] },
]

export default function BottomNav() {
  const { rol, signOut, accesosCentroC } = useAuth()
  const location = useLocation()

  if (rol === 'superadmin') return null

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.requiresAccesoCentro) return rol === 'admin' || accesosCentroC
    return !item.roles || (rol && item.roles.includes(rol))
  })

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-sm"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center h-16 px-1">
        {visibleItems.map((item) => {
          const isActive = item.matchPrefix
            ? location.pathname.startsWith(item.to)
            : location.pathname === item.to || location.pathname.startsWith(item.to + '/')
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-xl transition-colors ${
                isActive ? 'text-amber-600' : 'text-slate-400 active:text-slate-600'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </NavLink>
          )
        })}

        {/* Logout */}
        <button
          onClick={signOut}
          className="flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-xl text-slate-400 active:text-slate-500 transition-colors"
        >
          <LogOut size={22} />
          <span className="text-[10px] font-medium leading-none">Salir</span>
        </button>
      </div>
    </nav>
  )
}
