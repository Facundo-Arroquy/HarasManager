import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Spinner from './components/ui/Spinner'
import AppLayout from './components/layout/AppLayout'
import DevPanel from './dev/DevPanel'
import LoginPage from './pages/auth/LoginPage'
import CaballosPage from './pages/caballos/CaballosPage'
import HistorialPage from './pages/historial/HistorialPage'
import AdminPage from './pages/admin/AdminPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
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
          <Route index element={<Navigate to="/caballos" replace />} />
          <Route path="/caballos" element={<CaballosPage />} />
          <Route path="/caballos/:id/historial" element={<HistorialPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <DevPanel />
    </BrowserRouter>
  )
}
