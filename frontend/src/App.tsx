import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import { useAuth } from './hooks/useAuth'
import { useAuthStore } from './store/authStore'
import Spinner from './components/ui/Spinner'
import TerminosModal from './components/ui/TerminosModal'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/auth/LoginPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import {
  getTerminosVigentes,
  usuarioAceptoTerminos,
  aceptarTerminos,
  type TerminosVigentes,
} from './services/terminosService'
const LandingPage = lazy(() => import('./pages/landing/LandingPage'))
import SuperAdminPage from './pages/superadmin/SuperAdminPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import CaballosPage from './pages/caballos/CaballosPage'
import HistorialPage from './pages/historial/HistorialPage'
import AdminPage from './pages/admin/AdminPage'
import ConfigPage from './pages/config/ConfigPage'
import RevisionPreVentaPage from './pages/vet/RevisionPreVentaPage'
import PanelVetPage from './pages/vet/PanelVetPage'
import DashboardCriaPage from './pages/centro-cria/DashboardCriaPage'
import RecordatoriosPage from './pages/centro-cria/RecordatoriosPage'
import TransferenciasPage from './pages/centro-cria/TransferenciasPage'
import FlushingsPage from './pages/centro-cria/FlushingsPage'
import ProgramaSemanalPage from './pages/centro-cria/ProgramaSemanalPage'
import ConfigCriaPage from './pages/centro-cria/ConfigCriaPage'
import TransferirEmpresaPage from './pages/transferencias/TransferirEmpresaPage'
import TransferirVetPage from './pages/vet/TransferirVetPage'
import AlertasPage from './pages/alertas/AlertasPage'
import NotFoundPage from './pages/NotFoundPage'

function RootRedirect() {
  const { isAuthenticated, loading, session } = useAuth()
  const rol = useAuthStore((s) => s.rol)
  const perfilCargado = useAuthStore((s) => s.perfilCargado)

  if (loading || (session && !perfilCargado)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/landing" replace />
  if (rol === 'veterinario') return <Navigate to="/panel-vet" replace />
  return <Navigate to="/dashboard" replace />
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, rol, session, user } = useAuth()
  const perfilCargado = useAuthStore((s) => s.perfilCargado)

  const [terminosPendientes, setTerminosPendientes] = useState<TerminosVigentes | null>(null)
  const [checkandoTerminos, setCheckandoTerminos] = useState(false)
  const [terminosVerificados, setTerminosVerificados] = useState(false)

  useEffect(() => {
    if (!user?.id || !isAuthenticated) return
    if (terminosVerificados) return

    setCheckandoTerminos(true)
    getTerminosVigentes()
      .then(async (terminos) => {
        if (!terminos) { setTerminosVerificados(true); return }
        const acepto = await usuarioAceptoTerminos(user.id, terminos.id)
        if (!acepto) setTerminosPendientes(terminos)
        setTerminosVerificados(true)
      })
      .catch(() => setTerminosVerificados(true))
      .finally(() => setCheckandoTerminos(false))
  }, [user?.id, isAuthenticated, terminosVerificados])

  async function handleAceptar() {
    if (!user?.id || !terminosPendientes) return
    await aceptarTerminos(user.id, terminosPendientes.id)
    setTerminosPendientes(null)
  }

  // Esperar mientras carga la sesión, el perfil del usuario, o la verificación de términos
  if (loading || (session && !perfilCargado) || checkandoTerminos) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (rol === 'superadmin') return <Navigate to="/superadmin" replace />

  return (
    <>
      {terminosPendientes && (
        <TerminosModal terminos={terminosPendientes} onAceptar={handleAceptar} />
      )}
      {children}
    </>
  )
}

function RequireCentroCria() {
  const accesosCentroC = useAuthStore((s) => s.accesosCentroC)
  const accesosCentroCOrg = useAuthStore((s) => s.accesosCentroCOrg)
  const rol = useAuthStore((s) => s.rol)

  // Los veterinarios siempre tienen acceso al centro de cría
  if (rol === 'veterinario') return <Outlet />

  if (!accesosCentroC && !accesosCentroCOrg) {
    return <Navigate to="/dashboard" replace />
  }
  return <Outlet />
}

function RequireSuperAdmin() {
  const { loading, rol, session, isAuthenticated } = useAuth()
  const perfilCargado = useAuthStore((s) => s.perfilCargado)

  // Esperar mientras carga la sesión o el perfil del usuario
  if (loading || (session && !perfilCargado)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (rol !== 'superadmin') return <Navigate to="/dashboard" replace />
  return <Outlet />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/landing" element={<Suspense fallback={null}><LandingPage /></Suspense>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route index element={<RootRedirect />} />

        {/* Rutas protegidas — todas dentro del AppLayout */}
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/caballos" element={<CaballosPage />} />
          <Route path="/caballos/:id/historial" element={<HistorialPage />} />
          <Route path="/panel-vet" element={<PanelVetPage />} />
          <Route path="/revision-preventa" element={<RevisionPreVentaPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/config" element={<ConfigPage />} />
          {/* Centro de Embriones — requiere acceso explícito por usuario u organización */}
          <Route element={<RequireCentroCria />}>
            <Route path="/centro-cria" element={<DashboardCriaPage />} />
            <Route path="/centro-cria/programa" element={<ProgramaSemanalPage />} />
            <Route path="/centro-cria/recordatorios" element={<RecordatoriosPage />} />
            <Route path="/centro-cria/transferencias" element={<TransferenciasPage />} />
            <Route path="/centro-cria/flushings" element={<FlushingsPage />} />
            <Route path="/centro-cria/config" element={<ConfigCriaPage />} />
          </Route>
          <Route path="/transferencias" element={<TransferirEmpresaPage />} />
          <Route path="/transferir-vet" element={<TransferirVetPage />} />
          <Route path="/alertas" element={<AlertasPage />} />
        </Route>

        <Route element={<RequireSuperAdmin />}>
          <Route path="/superadmin" element={<SuperAdminPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>

    </BrowserRouter>
  )
}
