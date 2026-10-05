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
    <aside className="hidden md:flex h-full w-64 shrink-0 flex-col overflow-hidden rounded-[24px] border border-brand-700/10 bg-surface shadow-card">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-brand-700/10">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-app ring-1 ring-brand-700/10">
          <img src={logoUrl} alt="HarasManager" className="h-8 w-8 object-contain" />
        </div>
        <div className="min-w-0">
          <span className="block text-sm font-bold text-text-primary">HarasManager</span>
          <span className="block text-[9px] font-semibold uppercase tracking-[0.18em] text-brand">Gestión ecuestre</span>
        </div>
        <div className="ml-auto"><CampanaNotificaciones /></div>
      </div>

      {/* Establecimiento */}
      {sociedadActiva && (
        <div className="mx-3 mt-3 rounded-xl border border-brand-700/10 bg-surface-alt px-4 py-3">
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
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all ${
                      isActive
                        ? 'bg-brand-700 text-white font-semibold shadow-[0_3px_0_#6B4E1D] translate-y-0'
                        : 'text-slate-600 hover:bg-surface-alt hover:text-slate-900'
                    }`}
                  >
                    <span className={isActive ? 'text-white' : 'text-slate-400'}>
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
      <div className="m-3 mt-0 rounded-2xl border border-brand-700/10 bg-surface-alt p-2 space-y-1">
        <div className="px-2 py-1.5">
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
