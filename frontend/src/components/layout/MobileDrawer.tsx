import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { X, LogOut } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useVisibleNavGroups } from '../../hooks/useVisibleNavGroups'
import ConfigVetMenu from './ConfigVetMenu'
import logoUrl from '../../assets/logo.png'

interface Props {
  open: boolean
  onClose: () => void
}

export default function MobileDrawer({ open, onClose }: Props) {
  const { rol, sociedadActiva, user, signOut } = useAuth()
  const visibleGroups = useVisibleNavGroups()
  const location = useLocation()

  // Cerrar al navegar
  useEffect(() => { onClose() }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (rol === 'superadmin') return null

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 md:hidden ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-surface shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Header del drawer */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-brand-700/10">
          <div className="flex items-center gap-2.5">
            <img src={logoUrl} alt="HarasManager" className="h-8 w-8 object-contain" />
            <span className="text-sm font-bold text-slate-800">HarasManager</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
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
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                      isActive
                          ? 'bg-brand-700 text-white font-semibold shadow-[0_3px_0_#6B4E1D]'
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

        {/* Footer usuario */}
        <div className="m-3 rounded-2xl border border-brand-700/10 bg-surface-alt p-3 space-y-2">
          <div className="px-2">
            <p className="text-sm font-medium text-slate-700 truncate">{user?.email ?? '—'}</p>
            <p className="text-xs text-slate-400 capitalize">{rol ?? '—'}</p>
          </div>

          {/* Solo el vet independiente tiene qué configurar acá: la membresía. */}
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
    </>
  )
}
