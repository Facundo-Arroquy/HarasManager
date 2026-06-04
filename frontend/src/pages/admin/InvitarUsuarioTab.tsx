import { useState } from 'react'
import { Search, UserPlus, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { isMockMode } from '../../dev/mockMode'
import { getSupabaseClient } from '../../lib/supabase'

const ROLES = [
  { id: 1, nombre: 'admin',       label: 'Admin' },
  { id: 2, nombre: 'veterinario', label: 'Veterinario' },
  { id: 3, nombre: 'piloto',      label: 'Piloto' },
  { id: 4, nombre: 'jugador',     label: 'Jugador' },
  { id: 5, nombre: 'peticero',    label: 'Peticero' },
]

interface UsuarioEncontrado {
  id: string
  nombre: string
  apellido: string
  email: string
}

export default function InvitarUsuarioTab() {
  const { sociedadActiva } = useAuth()

  const [email,     setEmail]     = useState('')
  const [buscando,  setBuscando]  = useState(false)
  const [usuario,   setUsuario]   = useState<UsuarioEncontrado | null>(null)
  const [buscado,   setBuscado]   = useState(false)
  const [rolId,     setRolId]     = useState<number>(2)
  const [enviando,  setEnviando]  = useState(false)
  const [success,   setSuccess]   = useState<string | null>(null)
  const [error,     setError]     = useState<string | null>(null)

  function reset() {
    setEmail('')
    setUsuario(null)
    setBuscado(false)
    setRolId(2)
    setError(null)
  }

  async function handleBuscar(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setBuscando(true)
    setError(null)
    setUsuario(null)
    setBuscado(false)

    try {
      if (isMockMode()) {
        await new Promise((r) => setTimeout(r, 400))
        setUsuario({ id: 'mock-vet', nombre: 'Carlos', apellido: 'Gómez', email: email.trim() })
        setBuscado(true)
        return
      }

      const supabase = getSupabaseClient()
      const { data, error: rpcError } = await supabase.rpc('buscar_usuario_por_email', {
        p_email: email.trim(),
      })

      if (rpcError) throw rpcError

      if (!data || data.length === 0) {
        setUsuario(null)
      } else {
        setUsuario(data[0] as UsuarioEncontrado)
      }
      setBuscado(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al buscar el usuario.')
    } finally {
      setBuscando(false)
    }
  }

  async function handleInvitar() {
    if (!usuario || !sociedadActiva) return

    setEnviando(true)
    setError(null)
    setSuccess(null)

    try {
      if (isMockMode()) {
        await new Promise((r) => setTimeout(r, 500))
        setSuccess(`${usuario.nombre} ${usuario.apellido} fue agregado al haras.`)
        reset()
        return
      }

      const supabase = getSupabaseClient()

      // Verificar que no tenga ya una membresía activa en esta sociedad
      const { data: membExist } = await supabase
        .from('membresia')
        .select('id')
        .eq('usuario_id', usuario.id)
        .eq('sociedad_id', sociedadActiva.id)
        .eq('activa', true)
        .maybeSingle()

      if (membExist) {
        setError('Este usuario ya es miembro activo del haras.')
        return
      }

      const { error: membErr } = await supabase.from('membresia').insert({
        usuario_id:  usuario.id,
        sociedad_id: sociedadActiva.id,
        rol_id:      rolId,
        activa:      true,
      })

      if (membErr) throw membErr

      setSuccess(`${usuario.nombre} ${usuario.apellido} fue agregado al haras correctamente.`)
      reset()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al agregar al usuario.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="max-w-lg space-y-6">

      <div>
        <h2 className="text-sm font-medium text-slate-600">Invitar usuario existente</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Buscá por email a un usuario ya registrado en la plataforma para agregarlo a este haras.
        </p>
      </div>

      {success && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
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

      {/* Búsqueda por email */}
      <form onSubmit={handleBuscar} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setBuscado(false); setUsuario(null) }}
          placeholder="email@ejemplo.com"
          className="flex-1 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-brand-400 focus:outline-none"
          required
        />
        <button
          type="submit"
          disabled={buscando || !email.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          <Search size={14} />
          {buscando ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {/* Resultado de búsqueda */}
      {buscado && !usuario && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          No existe ningún usuario con ese email en la plataforma.{' '}
          <span className="font-medium">Pedile al superadmin que lo cree primero.</span>
        </div>
      )}

      {usuario && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 shrink-0">
              {usuario.nombre[0]}{usuario.apellido[0]}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">{usuario.nombre} {usuario.apellido}</p>
              <p className="text-xs text-slate-400 truncate">{usuario.email}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Rol en este haras *</label>
            <select
              value={rolId}
              onChange={(e) => setRolId(Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none"
            >
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleInvitar}
            disabled={enviando}
            className="flex items-center gap-2 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 px-5 py-2.5 text-sm font-medium text-white transition-colors"
          >
            <UserPlus size={15} />
            {enviando ? 'Agregando…' : 'Agregar al haras'}
          </button>
        </div>
      )}
    </div>
  )
}
