import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export default function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      {/* Sidebar — solo desktop */}
      <Sidebar />

      {/* Área de contenido */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* pb-16 en mobile para no quedar tapado por el BottomNav */}
        <div className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <Outlet />
        </div>
      </main>

      {/* Navegación inferior — solo mobile */}
      <BottomNav />
    </div>
  )
}
