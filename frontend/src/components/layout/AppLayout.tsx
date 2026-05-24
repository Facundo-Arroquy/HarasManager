import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, Wheat } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import Sidebar from './Sidebar'
import MobileDrawer from './MobileDrawer'

export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { rol } = useAuth()

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar — solo desktop */}
      <Sidebar />

      {/* Drawer — solo mobile */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Área de contenido */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar mobile */}
        {rol !== 'superadmin' && (
          <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 md:hidden shrink-0">
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              aria-label="Abrir menú"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500">
                <Wheat size={14} className="text-white" />
              </div>
              <span className="text-sm font-bold text-slate-800">HarasManager</span>
            </div>
          </header>
        )}

        {/* Contenido de la página */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
