import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import { useAuth } from './hooks/useAuth'
import { useAuthStore } from './store/authStore'
import { tieneAccesoModulo } from './utils/modulos'
import type { ModuloCodigo } from './types/modulo'
import Spinner from './components/ui/Spinner'
import TerminosModal from './components/ui/TerminosModal'
import ToastContainer from './components/ui/ToastContainer'
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
import RecordatoriosPage from './pages/centro-cria/RecordatoriosPage'
import TransferenciasPage from './pages/centro-cria/TransferenciasPage'
import ProgramaSemanalPage from './pages/centro-cria/ProgramaSemanalPage'
import ConfigCriaPage, { ConfigVetPage } from './pages/centro-cria/ConfigCriaPage'
import RankingPadrillosConfig from './pages/centro-cria/RankingPadrillosConfig'
import CaballosCentroPage from './pages/centro-cria/CaballosCentroPage'
import EmbrionesPage from './pages/centro-cria/EmbrionesPage'
import TorneosPage from './pages/torneos/TorneosPage'
import TorneoKanbanPage from './pages/torneos/TorneoKanbanPage'
import TransferirEmpresaPage from './pages/transferencias/TransferirEmpresaPage'
import TransferirVetPage from './pages/vet/TransferirVetPage'
import SanidadPage from './pages/sanidad/SanidadPage'
import CalendarioPage from './pages/calendario/CalendarioPage'
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
  if (rol === 'superadmin') return <Navigate to="/superadmin" replace />
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

/**
 * Guard de ruta genérico por módulo. Reemplaza RequireCentroCria — usa el
 * mismo predicado (tieneAccesoModulo) que el sidebar, así un módulo apagado
 * queda oculto del menú Y bloqueado por URL directa por igual (antes eran
 * dos chequeos distintos: el sidebar exigía AND, el guard se conformaba con
 * un OR-de-negaciones, y quedaban desincronizados).
 *
 * Rol y módulo se chequean por separado, no combinados: si el rol no
 * califica, siempre va a /dashboard — solo el fallo de MÓDULO manda al
 * veterinario a /panel-vet. Combinarlos mandaría a un veterinario que
 * visite una ruta con roles que no lo incluyen (p. ej. Torneos) al lugar
 * equivocado por la razón equivocada.
 */
function RequireModulo({ codigo, roles }: { codigo: ModuloCodigo; roles?: string[] }) {
  const rol = useAuthStore((s) => s.rol)
  const modulos = useAuthStore((s) => s.modulos)

  if (roles && rol && !roles.includes(rol)) {
    return <Navigate to="/dashboard" replace />
  }

  if (!tieneAccesoModulo(rol, modulos, codigo)) {
    return rol === 'veterinario'
      ? <Navigate to="/panel-vet" replace />
      : <Navigate to="/dashboard" replace />
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
          <Route path="/calendario" element={<CalendarioPage />} />
          <Route path="/caballos" element={<CaballosPage />} />
          <Route path="/caballos/:id/historial" element={<HistorialPage />} />
          <Route path="/sanidad" element={<SanidadPage />} />
          <Route path="/panel-vet" element={<PanelVetPage />} />
          <Route path="/revision-preventa" element={<RevisionPreVentaPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/config" element={<ConfigPage />} />
          {/* Centro de Embriones — requiere módulo habilitado por usuario u organización */}
          <Route element={<RequireModulo codigo="centro_cria" />}>
            {/* El panel reproductivo se eliminó; el centro entra por el programa
                semanal, que es la primera sección del grupo. */}
            <Route path="/centro-cria" element={<Navigate to="/centro-cria/programa" replace />} />
            <Route path="/centro-cria/caballos" element={<CaballosCentroPage />} />
            <Route path="/centro-cria/programa" element={<ProgramaSemanalPage />} />
            <Route path="/centro-cria/recordatorios" element={<RecordatoriosPage />} />
            <Route path="/centro-cria/transferencias" element={<TransferenciasPage />} />
            {/* La sección de flushings se absorbió en "Embriones vitrificados";
                se deja el redirect para los links guardados. */}
            <Route path="/centro-cria/flushings" element={<Navigate to="/centro-cria/embriones" replace />} />
            <Route path="/centro-cria/embriones" element={<EmbrionesPage />} />
            {/* Configuración del centro: una subsección por pestaña */}
            <Route path="/centro-cria/config" element={<ConfigCriaPage />}>
              <Route index element={<Navigate to="/centro-cria/config/padrillos" replace />} />
              <Route path="padrillos" element={<RankingPadrillosConfig />} />
              <Route path="vet" element={<ConfigVetPage />} />
            </Route>
          </Route>
          {/* Polo / Torneos — antes sin ningún guard de ruta, dependía solo de
              que el sidebar lo ocultara */}
          <Route element={<RequireModulo codigo="polo" roles={['admin', 'jugador', 'piloto']} />}>
            <Route path="/torneos" element={<TorneosPage />} />
            <Route path="/torneos/:id" element={<TorneoKanbanPage />} />
          </Route>
          <Route path="/transferencias" element={<TransferirEmpresaPage />} />
          <Route path="/transferir-vet" element={<TransferirVetPage />} />
        </Route>

        <Route element={<RequireSuperAdmin />}>
          <Route path="/superadmin" element={<SuperAdminPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      <ToastContainer />
    </BrowserRouter>
  )
}
