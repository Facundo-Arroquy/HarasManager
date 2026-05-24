import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Stethoscope, AlertTriangle } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

export default function LoginPage() {
  const { signIn, isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()

  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [showPass,   setShowPass]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')
  const [visible,    setVisible]    = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, loading, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError('')
    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? (err.message.includes('Invalid login') ? 'Credenciales incorrectas.' : err.message)
          : 'Error al iniciar sesión.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const noSupabase = !import.meta.env.VITE_SUPABASE_URL

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950">
      {/* Video de fondo */}
      <video autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover">
        <source src="/video-caballos.mp4" type="video/mp4" />
      </video>

      {/* Overlay oscuro */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Tarjeta */}
      <div
        className={`relative z-10 w-full max-w-sm px-4 transition-all duration-700 ease-out ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        <div className="rounded-2xl border border-white/10 bg-zinc-900/85 p-8 shadow-2xl backdrop-blur-md">

          {/* Logo */}
          <div className="mb-6 flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 shadow-lg">
              <Stethoscope size={22} className="text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold text-zinc-100 tracking-tight">HarasManager</h1>
              <p className="mt-0.5 text-xs text-zinc-500">Gestión de establecimientos equinos</p>
            </div>
          </div>

          {noSupabase && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-800/40 bg-amber-900/20 px-3 py-2.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
              <p className="text-xs text-amber-300 leading-relaxed">
                Configurá <code className="font-mono text-amber-200">.env.local</code> con{' '}
                <code className="font-mono text-amber-200">VITE_SUPABASE_URL</code> y{' '}
                <code className="font-mono text-amber-200">VITE_SUPABASE_ANON</code>.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400" htmlFor="email">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@ejemplo.com"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400" htmlFor="password">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 pr-10 text-sm text-zinc-100 placeholder-zinc-600 transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-md border border-rose-800/40 bg-rose-900/30 px-3 py-2 text-xs text-rose-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || noSupabase}
              className="mt-2 w-full rounded-lg bg-emerald-700 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50 active:scale-[0.98]"
            >
              {submitting ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-[11px] text-zinc-600">
          © {new Date().getFullYear()} HarasManager
        </p>
      </div>
    </div>
  )
}
