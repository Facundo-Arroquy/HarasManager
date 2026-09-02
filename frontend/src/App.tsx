import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import { useAuth, useAuthListener } from './hooks/useAuth'
import { useAuthStore } from './store/authStore'
import { tieneAccesoModulo } from './utils/modulos'
import type { ModuloCodigo } from './types/modulo'
import Spinner from './components/ui/Spinner'
import TerminosModal from './components/ui/TerminosModal'
import LimiteCaballosVetModal from './components/domain/LimiteCaballosVetModal'
import ToastContainer from './components/ui/ToastContainer'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/auth/LoginPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import RegistroVeterinarioPage from './pages/auth/RegistroVeterinarioPage'
import {
  getTerminosVigentes,
  usuarioAceptoTerminos,
  aceptarTerminos,
  type TerminosVigentes,
} from './services/terminosService'
import { vetLimiteService, type EstadoLimiteVet } from './services/vetLimiteService'
const LandingPage = lazy(() => import('./pages/landing/LandingPage'))
const LegalPage = lazy(() => import('./pages/legales/LegalPage'))
import SuperAdminPage from './pages/superadmin/SuperAdminPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import CaballosPage from './pages/caballos/CaballosPage'
import HistorialPage from './pages/historial/HistorialPage'
import AdminPage from './pages/admin/AdminPage'
import ConfigPage from './pages/config/ConfigPage'
import CamposVetPage from './pages/config/CamposVetPage'
import DatosVetPage from './pages/config/DatosVetPage'
import RevisionPreVentaPage from './pages/vet/RevisionPreVentaPage'
import PanelVetPage from './pages/vet/PanelVetPage'
import SuscripcionResultadoPage from './pages/vet/SuscripcionResultadoPage'
import SuscripcionVetPage from './pages/vet/SuscripcionVetPage'
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

  // Estado del plan gratuito del vet. Solo aplica a rol veterinario: para
  // cualquier otro rol el chequeo ni se dispara.
  const [limiteVet, setLimiteVet] = useState<EstadoLimiteVet | null>(null)
  const [limiteVerificado, setLimiteVerificado] = useState(false)

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

  // Chequeo retroactivo del límite freemium. Corre una sola vez por sesión, al
  // entrar: si el vet quedó por encima del plan gratuito sin suscripción
  // vigente (típicamente porque pagó un mes, cargó de más y dejó de pagar), el
  // modal lo obliga a regularizar antes de seguir usando la app.
  useEffect(() => {
    if (limiteVerificado) return
    // Hay que esperar a que el perfil cargue, si no `rol` todavía es null y se
    // daría por verificado a un vet sin haberlo chequeado nunca.
    if (loading || (session && !perfilCargado)) return
    if (!isAuthenticated || !user?.id || rol !== 'veterinario') {
      setLimiteVerificado(true)
      return
    }

    vetLimiteService.estado()
      .then(setLimiteVet)
      // Si la verificación falla no se bloquea al vet: el gate real del alta
      // sigue viviendo en la base (`crear_caballo_veterinario`), así que un
      // error acá no le abre la puerta a nada.
      .catch(() => setLimiteVet(null))
      .finally(() => setLimiteVerificado(true))
  }, [user?.id, isAuthenticated, rol, limiteVerificado, loading, session, perfilCargado])

  async function handleAceptar() {
    if (!user?.id || !terminosPendientes) return
    await aceptarTerminos(user.id, terminosPendientes.id)
    setTerminosPendientes(null)
  }

  // Esperar mientras carga la sesión, el perfil del usuario, o la verificación de términos
  if (loading || (session && !perfilCargado) || checkandoTerminos || !limiteVerificado) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (rol === 'superadmin') return <Navigate to="/superadmin" replace />

  // Los T&C tienen prioridad: si están pendientes, el modal del límite espera
  // su turno para no apilar dos bloqueantes uno encima del otro.
  const debeRegularizar = !terminosPendientes && limiteVet?.debe_regularizar === true

  return (
    <>
      {terminosPendientes && (
        <TerminosModal terminos={terminosPendientes} onAceptar={handleAceptar} />
      )}
      {debeRegularizar && limiteVet && (
        <LimiteCaballosVetModal
          estado={limiteVet}
          onResuelto={() => { setLimiteVet(null); setLimiteVerificado(false) }}
        />
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

/**
 * Guard de ruta por rol, para las secciones que no dependen de un módulo.
 * Antes `/admin`, `/config`, `/transferencias`, `/revision-preventa` y
 * `/transferir-vet` solo estaban ocultas del sidebar (`navItems.tsx`) pero
 * abiertas por URL directa — la misma desincronización que `RequireModulo` ya
 * resolvía para centro-cría y polo. Las listas de roles replican las de
 * `navItems.tsx`. La RLS sigue siendo la barrera real de datos; esto alinea la
 * navegación.
 */
function RequireRol({ roles }: { roles: string[] }) {
  const rol = useAuthStore((s) => s.rol)
  if (!rol || !roles.includes(rol)) {
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
  useAuthListener()
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/landing" element={<Suspense fallback={null}><LandingPage /></Suspense>} />
        <Route path="/legales/terminos" element={<Suspense fallback={null}><LegalPage tipo="terminos" /></Suspense>} />
        <Route path="/legales/privacidad" element={<Suspense fallback={null}><LegalPage tipo="privacidad" /></Suspense>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro-veterinario" element={<RegistroVeterinarioPage />} />
        {/* Vuelta del checkout de MercadoPago. Fuera de RequireAuth a propósito:
            ese guard monta el modal bloqueante del límite, que dejaría al vet
            atrapado justo mientras esperamos la confirmación que lo libera. */}
        <Route path="/suscripcion/resultado" element={<SuscripcionResultadoPage />} />
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

          {/* Secciones solo-veterinario */}
          <Route element={<RequireRol roles={['veterinario']} />}>
            {/* Configuración del vet independiente. */}
            <Route path="/config-vet" element={<Navigate to="/config-vet/suscripcion" replace />} />
            <Route path="/config-vet/suscripcion" element={<SuscripcionVetPage />} />
            <Route path="/config-vet/campos" element={<CamposVetPage />} />
            <Route path="/config-vet/datos" element={<DatosVetPage />} />
            <Route path="/revision-preventa" element={<RevisionPreVentaPage />} />
            <Route path="/transferir-vet" element={<TransferirVetPage />} />
          </Route>

          {/* Solo el admin de la empresa */}
          <Route element={<RequireRol roles={['admin']} />}>
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/transferencias" element={<TransferirEmpresaPage />} />
          </Route>

          {/* Configuración del establecimiento */}
          <Route element={<RequireRol roles={['admin', 'jugador', 'piloto']} />}>
            <Route path="/config" element={<ConfigPage />} />
          </Route>
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
