import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { getSupabaseClient } from '../../lib/supabase'
import logoUrl from '../../assets/logo.png'

type Paso = 'form' | 'revisa-email'

export default function RegistroVeterinarioPage() {
  const navigate = useNavigate()

  const [paso, setPaso] = useState<Paso>('form')
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError('')

    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    if (password !== confirmar) return setError('Las contraseñas no coinciden.')

    setSubmitting(true)
    try {
      const supabase = getSupabaseClient()
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            nombre: nombre.trim(),
            apellido: apellido.trim(),
            rol_solicitado: 'veterinario',
          },
        },
      })
      if (signUpError) throw signUpError

      // La aceptación de T&C queda pendiente para RequireAuth (App.tsx), que
      // se la pide a cualquier usuario logueado sin la versión vigente
      // aceptada — mismo mecanismo que usa el resto de la app. `session` va a
      // venir null si "Confirm email" está prendido en el Dashboard de
      // Supabase (estado esperado, ver docs/SKILL.md → "Suscripción de
      // veterinarios independientes"); si estuviera apagado, entra directo y
      // el modal de T&C aparece apenas cargue la próxima pantalla.
      if (data.session) {
        navigate('/', { replace: true })
      } else {
        setPaso('revisa-email')
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? (err.message.includes('already registered') ? 'Ese email ya está registrado.' : err.message)
          : 'Error al crear la cuenta.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-4">
      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/85 p-10 shadow-2xl backdrop-blur-md">

          <div className="mb-8 flex flex-col items-center gap-4">
            <img src={logoUrl} alt="HarasManager" className="h-20 w-20 rounded-2xl object-cover shadow-lg" />
            <div className="text-center">
              <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Registro de veterinario</h1>
              <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                Gratis hasta 5 caballos propios, sin necesidad de pertenecer a un haras.
              </p>
            </div>
          </div>

          {paso === 'revisa-email' ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <CheckCircle2 size={40} className="text-emerald-400" />
              <p className="text-sm text-zinc-300">
                Te enviamos un email de confirmación a <span className="text-zinc-100">{email}</span>.
                Confirmalo y después iniciá sesión con tu contraseña.
              </p>
              <Link to="/login" className="mt-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                Ir a iniciar sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400" htmlFor="nombre">Nombre</label>
                  <input
                    id="nombre"
                    type="text"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 transition focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400" htmlFor="apellido">Apellido</label>
                  <input
                    id="apellido"
                    type="text"
                    required
                    value={apellido}
                    onChange={(e) => setApellido(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 transition focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400" htmlFor="email">Correo electrónico</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@ejemplo.com"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 transition focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400" htmlFor="password">Contraseña</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 pr-10 text-sm text-zinc-100 placeholder-zinc-600 transition focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400" htmlFor="confirmar">Confirmar contraseña</label>
                <input
                  id="confirmar"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 transition focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {error && (
                <p className="rounded-md border border-rose-800/40 bg-rose-900/30 px-3 py-2 text-xs text-rose-400">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50 active:scale-[0.98]"
              >
                {submitting ? 'Creando cuenta…' : 'Crear cuenta gratis'}
              </button>

              <div className="text-center">
                <Link to="/login" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                  ¿Ya tenés cuenta? Iniciá sesión
                </Link>
              </div>
            </form>
          )}
        </div>

        <p className="mt-5 text-center text-[11px] text-zinc-600">
          © {new Date().getFullYear()} HarasManager
        </p>
      </div>
    </div>
  )
}
