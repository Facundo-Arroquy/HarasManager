import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import Sidebar from './Sidebar'
import MobileDrawer from './MobileDrawer'
import CampanaNotificaciones from './CampanaNotificaciones'
import logoUrl from '../../assets/logo.png'

export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { rol } = useAuth()

  return (
    <div className="hm-app flex h-screen overflow-hidden bg-app p-0 md:p-3 md:gap-3">
      {/* Sidebar — solo desktop */}
      <Sidebar />

      {/* Drawer — solo mobile */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Área de contenido */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar mobile */}
        {rol !== 'superadmin' && (
          <header className="flex items-center gap-3 px-4 py-3 bg-surface border-b border-brand-700/10 md:hidden shrink-0 shadow-card">
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              aria-label="Abrir menú"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2">
              <img src={logoUrl} alt="HarasManager" className="h-7 w-7 object-contain" />
              <span className="text-sm font-bold text-slate-800">HarasManager</span>
            </div>
            <div className="ml-auto"><CampanaNotificaciones /></div>
          </header>
        )}

        {/* Contenido de la página */}
        <div className="hm-content-scroll flex-1 overflow-y-auto md:rounded-[24px]">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
