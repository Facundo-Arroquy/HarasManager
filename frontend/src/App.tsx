import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Spinner from './components/ui/Spinner'
import AppLayout from './components/layout/AppLayout'
import DevPanel from './dev/DevPanel'
import LoginPage from './pages/auth/LoginPage'
import SuperAdminPage from './pages/superadmin/SuperAdminPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import CaballosPage from './pages/caballos/CaballosPage'
import HistorialPage from './pages/historial/HistorialPage'
import AdminPage from './pages/admin/AdminPage'
import ConfigPage from './pages/config/ConfigPage'
import RevisionPreVentaPage from './pages/vet/RevisionPreVentaPage'
import DashboardCriaPage from './pages/centro-cria/DashboardCriaPage'
import RecordatoriosPage from './pages/centro-cria/RecordatoriosPage'
import TransferenciasPage from './pages/centro-cria/TransferenciasPage'
import FlushingsPage from './pages/centro-cria/FlushingsPage'
import ProgramaSemanalPage from './pages/centro-cria/ProgramaSemanalPage'
import TransferirEmpresaPage from './pages/transferencias/TransferirEmpresaPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, rol, session } = useAuth()

  // Esperar mientras carga la sesión O mientras la sesión existe pero el rol aún no fue cargado
  if (loading || (session && rol === null)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (rol === 'superadmin') return <Navigate to="/superadmin" replace />
  return <>{children}</>
}

function RequireSuperAdmin() {
  const { loading, rol, session } = useAuth()

  // Esperar mientras carga la sesión O mientras la sesión existe pero el rol aún no fue cargado
  if (loading || (session && rol === null)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  if (rol !== 'superadmin') return <Navigate to="/dashboard" replace />
  return <Outlet />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Rutas protegidas — todas dentro del AppLayout */}
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/caballos" element={<CaballosPage />} />
          <Route path="/caballos/:id/historial" element={<HistorialPage />} />
          <Route path="/revision-preventa" element={<RevisionPreVentaPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/config" element={<ConfigPage />} />
          {/* Centro de Embriones — accesible para veterinario y admin */}
          <Route path="/centro-cria" element={<DashboardCriaPage />} />
          <Route path="/centro-cria/programa" element={<ProgramaSemanalPage />} />
          <Route path="/centro-cria/recordatorios" element={<RecordatoriosPage />} />
          <Route path="/centro-cria/transferencias" element={<TransferenciasPage />} />
          <Route path="/centro-cria/flushings" element={<FlushingsPage />} />
          <Route path="/transferencias" element={<TransferirEmpresaPage />} />
        </Route>

        <Route element={<RequireSuperAdmin />}>
          <Route path="/superadmin" element={<SuperAdminPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <DevPanel />
    </BrowserRouter>
  )
}
