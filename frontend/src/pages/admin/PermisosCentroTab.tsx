import { useEffect, useState } from 'react'
import { FlaskConical, Lock } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useAuthStore } from '../../store/authStore'
import {
  listarAccesosCentroCria,
  actualizarAccesoCentroCria,
  type UserAccesoCentro,
} from '../../services/accesoCentroCriaService'

const ROL_BADGE: Record<string, string> = {
  admin:       'bg-violet-900/40 text-violet-400',
  veterinario: 'bg-emerald-900/40 text-emerald-400',
  piloto:      'bg-sky-900/40 text-sky-400',
  jugador:     'bg-amber-900/40 text-amber-400',
  peticero:    'bg-rose-900/40 text-rose-400',
}

export default function PermisosCentroTab() {
  const { sociedadActiva, user } = useAuth()
  const setAccesosCentroC = useAuthStore((s) => s.setAccesosCentroC)
  const [usuarios, setUsuarios] = useState<UserAccesoCentro[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  async function cargar() {
    if (!sociedadActiva) return
    const data = await listarAccesosCentroCria(sociedadActiva.id)
    setUsuarios(data)
    setLoading(false)
  }

  useEffect(() => { cargar() }, [sociedadActiva]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleToggle(u: UserAccesoCentro) {
    if (u.rol === 'admin') return // admin siempre tiene acceso
    setToggling(u.id)
    try {
      await actualizarAccesoCentroCria(u.id, !u.tieneAcceso, sociedadActiva?.id)
      // Si el toggle afecta al usuario actual, actualizar el store
      if (u.id === user?.id) {
        setAccesosCentroC(!u.tieneAcceso)
      }
      await cargar()
    } finally {
      setToggling(null)
    }
  }

  if (loading) return <p className="text-sm text-zinc-500">Cargando permisos…</p>

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <h2 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          <FlaskConical size={14} className="text-emerald-400" />
          Acceso al Centro de Cría
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Activá o desactivá el módulo Centro de Embriones para cada usuario.
          Los administradores siempre tienen acceso.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-hidden divide-y divide-zinc-800">
        {usuarios.map((u) => {
          const esAdmin = u.rol === 'admin'
          const isToggling = toggling === u.id
          return (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3 bg-zinc-900">
              {/* Avatar */}
              <div className="shrink-0 w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-400">
                {(u.nombre?.[0] ?? '?').toUpperCase()}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">
                  {u.nombre} {u.apellido}
                </p>
                <p className="text-xs text-zinc-500 font-mono truncate">{u.email}</p>
              </div>
              {/* Rol badge */}
              <span
                className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${
                  ROL_BADGE[u.rol] ?? 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {u.rol}
              </span>
              {/* Toggle */}
              {esAdmin ? (
                <div
                  title="El admin siempre tiene acceso"
                  className="shrink-0 flex items-center gap-1 text-xs text-zinc-600"
                >
                  <Lock size={12} />
                </div>
              ) : (
                <button
                  onClick={() => handleToggle(u)}
                  disabled={isToggling}
                  className={`shrink-0 relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-40 ${
                    u.tieneAcceso ? 'bg-emerald-600' : 'bg-zinc-700'
                  }`}
                  title={u.tieneAcceso ? 'Quitar acceso' : 'Dar acceso'}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      u.tieneAcceso ? 'translate-x-[18px]' : 'translate-x-[3px]'
                    }`}
                  />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
