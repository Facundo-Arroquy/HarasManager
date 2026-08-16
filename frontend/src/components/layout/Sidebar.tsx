import { NavLink, useLocation } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useVisibleNavGroups } from '../../hooks/useVisibleNavGroups'
import ConfigVetMenu from './ConfigVetMenu'
import CampanaNotificaciones from './CampanaNotificaciones'
import logoUrl from '../../assets/logo.png'

export default function Sidebar() {
  const { rol, sociedadActiva, user, signOut } = useAuth()
  const visibleGroups = useVisibleNavGroups()
  const location = useLocation()

  if (rol === 'superadmin') return null

  return (
    <aside className="hidden md:flex h-screen w-60 flex-col border-r border-slate-200 bg-white">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-100">
        <img src={logoUrl} alt="HarasManager" className="h-8 w-8 object-contain" />
        <span className="text-sm font-bold text-slate-800">HarasManager</span>
        <div className="ml-auto"><CampanaNotificaciones /></div>
      </div>

      {/* Establecimiento */}
      {sociedadActiva && (
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">
            Establecimiento
          </p>
          <p className="text-sm font-medium text-slate-700 truncate">
            {sociedadActiva.nombre}
          </p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location.pathname.startsWith(item.to)
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? 'bg-brand-50 text-brand-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className={isActive ? 'text-brand-500' : 'text-slate-400'}>
                      {item.icon}
                    </span>
                    {item.label}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-100 p-3 space-y-1">
        <div className="px-2 py-1">
          <p className="text-sm font-medium text-slate-700 truncate">{user?.email ?? '—'}</p>
          <p className="text-xs text-slate-400 capitalize">{rol ?? '—'}</p>
        </div>

        {/* Solo el vet independiente tiene qué configurar acá: la membresía.
            Para los demás roles la sección quedaría vacía. */}
        {rol === 'veterinario' && <ConfigVetMenu />}

        <button
          onClick={signOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut size={15} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
