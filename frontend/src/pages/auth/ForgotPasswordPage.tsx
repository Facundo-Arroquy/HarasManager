import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { getSupabaseClient } from '../../lib/supabase'
import logoUrl from '../../assets/logo.png'

export default function ForgotPasswordPage() {
  const [email,      setEmail]      = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent,       setSent]       = useState(false)
  const [error,      setError]      = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError('')
    setSubmitting(true)

    try {
      const supabase = getSupabaseClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/reset-password` },
      )
      if (resetError) throw resetError
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al enviar el email.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/85 p-10 shadow-2xl backdrop-blur-md">

          <div className="mb-8 flex flex-col items-center gap-4">
            <img src={logoUrl} alt="HarasManager" className="h-16 w-16 rounded-2xl object-cover shadow-lg" />
            <div className="text-center">
              <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Recuperar contraseña</h1>
              <p className="mt-0.5 text-xs text-zinc-500">Te enviamos un link para resetearla</p>
            </div>
          </div>

          {sent ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <CheckCircle2 size={40} className="text-emerald-400" />
              <p className="text-sm text-zinc-300">
                Si el email está registrado, vas a recibir un link para crear una nueva contraseña.
              </p>
              <Link
                to="/login"
                className="mt-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
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
                {submitting ? 'Enviando…' : 'Enviar link de recuperación'}
              </button>

              <div className="text-center">
                <Link
                  to="/login"
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Volver al inicio de sesión
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
