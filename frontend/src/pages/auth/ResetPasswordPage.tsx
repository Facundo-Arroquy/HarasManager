import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { getSupabaseClient } from '../../lib/supabase'
import logoUrl from '../../assets/logo.png'

export default function ResetPasswordPage() {
  const navigate = useNavigate()

  const [ready,      setReady]      = useState(false)  // token válido detectado
  const [password,   setPassword]   = useState('')
  const [confirmar,  setConfirmar]  = useState('')
  const [showPass,   setShowPass]   = useState(false)
  const [showConf,   setShowConf]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done,       setDone]       = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    const supabase = getSupabaseClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Si no hay token en el hash, redirigir al login después de un momento
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('access_token') && !hash.includes('type=recovery')) {
      const t = setTimeout(() => navigate('/login', { replace: true }), 2000)
      return () => clearTimeout(t)
    }
  }, [navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setSubmitting(true)
    try {
      const supabase = getSupabaseClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setDone(true)
      setTimeout(() => navigate('/dashboard', { replace: true }), 2500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al actualizar la contraseña.')
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
              <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Nueva contraseña</h1>
              <p className="mt-0.5 text-xs text-zinc-500">Elegí una contraseña segura</p>
            </div>
          </div>

          {done ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <CheckCircle2 size={40} className="text-emerald-400" />
              <p className="text-sm text-zinc-300">
                Contraseña actualizada. Redirigiendo…
              </p>
            </div>
          ) : !ready ? (
            <p className="text-center text-sm text-zinc-500">
              Verificando link… si no hay acción en unos segundos,{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-brand-400 hover:text-brand-300 underline"
              >
                volvé al login
              </button>
              .
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Nueva contraseña</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    required
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
                <label className="text-xs font-medium text-zinc-400">Confirmar contraseña</label>
                <div className="relative">
                  <input
                    type={showConf ? 'text' : 'password'}
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    placeholder="Repetí la contraseña"
                    required
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 pr-10 text-sm text-zinc-100 placeholder-zinc-600 transition focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConf((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showConf ? <EyeOff size={15} /> : <Eye size={15} />}
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
                disabled={submitting}
                className="mt-2 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50 active:scale-[0.98]"
              >
                {submitting ? 'Guardando…' : 'Guardar contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
