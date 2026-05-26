import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function NotFoundPage() {
  const navigate = useNavigate()
  const rol = useAuthStore((s) => s.rol)

  function handleVolver() {
    if (!rol) { navigate('/login', { replace: true }); return }
    if (rol === 'superadmin') { navigate('/superadmin', { replace: true }); return }
    if (rol === 'veterinario') { navigate('/panel-vet', { replace: true }); return }
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-slate-600">
      <span className="text-6xl font-bold text-slate-300">404</span>
      <p className="text-lg">Página no encontrada</p>
      <button
        onClick={handleVolver}
        className="px-4 py-2 text-sm rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
      >
        Volver al inicio
      </button>
    </div>
  )
}
