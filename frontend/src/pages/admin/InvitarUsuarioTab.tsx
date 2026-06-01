import { useState } from 'react'
import { UserPlus, CheckCircle2, AlertCircle, Lock } from 'lucide-react'
import Tooltip from '../../components/ui/Tooltip'

// ── TEMPORALMENTE DESHABILITADO ──────────────────────────────────────────────
// Se reactiva cuando esté lista la lógica de invitaciones en producción.
const HABILITADO = false
// ─────────────────────────────────────────────────────────────────────────────
import { useAuth } from '../../hooks/useAuth'
import { isMockMode } from '../../dev/mockMode'
import { getSupabaseClient } from '../../lib/supabase'

// Roles disponibles (mirror de cat_rol seed)
const ROLES = [
  { id: 1, nombre: 'admin',       label: 'Admin' },
  { id: 2, nombre: 'veterinario', label: 'Veterinario' },
  { id: 3, nombre: 'piloto',      label: 'Piloto' },
  { id: 4, nombre: 'jugador',     label: 'Jugador' },
  { id: 5, nombre: 'peticero',    label: 'Peticero' },
]

function generateTempPassword(): string {
  return crypto.randomUUID().replace(/-/g, '') + 'Aa1!'
}

export default function InvitarUsuarioTab() {
  const { sociedadActiva } = useAuth()

  const [loading,  setLoading]  = useState(false)
  const [success,  setSuccess]  = useState<string | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  // Campos del formulario
  const [nombre,   setNombre]   = useState('')
  const [apellido, setApellido] = useState('')
  const [email,    setEmail]    = useState('')
  const [rolId,    setRolId]    = useState<number>(2)  // veterinario por defecto

  function reset() {
    setNombre(''); setApellido(''); setEmail('')
    setRolId(2)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!sociedadActiva) return
    if (!nombre.trim() || !apellido.trim() || !email.trim()) {
      setError('Completá nombre, apellido y email.'); return
    }

    setLoading(true); setError(null); setSuccess(null)

    try {
      if (isMockMode()) {
        // En mock: simular éxito sin llamadas reales
        await new Promise((r) => setTimeout(r, 600))
        setSuccess(`Invitación enviada a ${email} (simulado en modo demo).`)
        reset()
        return
      }

      const supabase = getSupabaseClient()

      // 1. Crear usuario en auth (dispara el trigger → crea public.usuario)
      const { data: authData, error: signUpErr } = await supabase.auth.signUp({
        email,
        password: generateTempPassword(),
        options: {
          data: { nombre: nombre.trim(), apellido: apellido.trim() },
          emailRedirectTo: window.location.origin,
        },
      })

      if (signUpErr) {
        // Mensajes más amigables para errores comunes
        if (signUpErr.message.includes('Signups not allowed')) {
          setError(
            'El registro público está deshabilitado en Supabase. ' +
            'Habilitalo en Authentication → Settings → Allow new users to sign up.'
          )
        } else if (signUpErr.message.includes('already registered')) {
          setError('Ya existe un usuario con ese email.')
        } else {
          setError(signUpErr.message)
        }
        return
      }

      const userId = authData.user?.id
      if (!userId) {
        setError('No se pudo obtener el ID del usuario creado.')
        return
      }

      // 2. Crear membresía (permitido para admin por RLS)
      const { error: membErr } = await supabase.from('membresia').insert({
        usuario_id:  userId,
        sociedad_id: sociedadActiva.id,
        rol_id:      rolId,
        activa:      true,
      })

      if (membErr) {
        setError('Usuario creado pero no se pudo asignar el rol: ' + membErr.message)
        return
      }

      setSuccess(`Invitación enviada a ${email}. El usuario recibirá un email para confirmar su cuenta.`)
      reset()

    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error inesperado.')
    } finally {
      setLoading(false)
    }
  }

  if (!HABILITADO) {
    return (
      <div className="max-w-lg">
        <div>
          <h2 className="text-sm font-medium text-slate-600">Invitar nuevo usuario</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            El usuario recibirá un email para activar su cuenta y establecer su contraseña.
          </p>
        </div>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 py-12 text-center">
          <Lock size={24} className="text-slate-400" />
          <p className="text-sm font-medium text-slate-500">Próximamente</p>
          <p className="text-xs text-slate-400 max-w-xs">
            Esta función estará disponible en una próxima versión.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg space-y-6">

      <div>
        <h2 className="text-sm font-medium text-slate-600">Invitar nuevo usuario</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          El usuario recibirá un email para activar su cuenta y establecer su contraseña.
        </p>
      </div>

      {/* Feedback */}
      {success && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-800 bg-brand-50/50 px-4 py-3 text-sm text-brand-500">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nombre + Apellido */}
        <div className="grid grid-cols-2 gap-3">
          <div className={field}>
            <label className={label}>Nombre *</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="María"
              className={input}
              required
            />
          </div>
          <div className={field}>
            <label className={label}>Apellido *</label>
            <input
              type="text"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              placeholder="García"
              className={input}
              required
            />
          </div>
        </div>

        {/* Email */}
        <div className={field}>
          <label className={label}>Email *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="maria@ejemplo.com"
            className={input}
            required
          />
        </div>

        {/* Rol */}
        <div className={field}>
          <div className="flex items-center gap-1.5">
            <label className={label}>Rol *</label>
            <Tooltip text="Define qué puede hacer el usuario: Admin (gestión completa), Veterinario (registros clínicos), Piloto / Jugador (solo ve sus caballos), Peticero (vista limitada)." />
          </div>
          <select
            value={rolId}
            onChange={(e) => setRolId(Number(e.target.value))}
            className={select}
          >
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-brand-500 hover:bg-brand-500 disabled:opacity-50 px-5 py-2.5 text-sm font-medium text-white transition-colors"
        >
          <UserPlus size={15} />
          {loading ? 'Enviando…' : 'Enviar invitación'}
        </button>
      </form>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const field  = 'flex flex-col gap-1'
const label  = 'text-xs font-medium text-slate-500'
const base   = 'rounded-lg border border-slate-300 bg-slate-100 text-sm text-slate-700 placeholder-slate-400 focus:border-brand-400 focus:outline-none px-3 py-2 w-full'
const input  = base
const select = base
