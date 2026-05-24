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
  admin:       'bg-violet-100 text-violet-700',
  veterinario: 'bg-amber-100 text-amber-700',
  piloto:      'bg-sky-100 text-sky-700',
  jugador:     'bg-green-100 text-green-700',
  peticero:    'bg-rose-100 text-rose-700',
}

export default function PermisosCentroTab() {
  const { sociedadActiva, user } = useAuth()
  const setAccesosCentroC = useAuthStore((s) => s.setAccesosCentroC)
  const [usuarios, setUsuarios] = useState<UserAccesoCentro[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  async function cargar() {
    if (!sociedadActiva) return
    try {
      const data = await listarAccesosCentroCria(sociedadActiva.id)
      setUsuarios(data)
    } catch {
      // silencioso — se muestra lista vacía
    } finally {
      setLoading(false)
    }
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

  if (loading) return <p className="text-sm text-slate-400">Cargando permisos…</p>

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <h2 className="text-sm font-medium text-slate-600 flex items-center gap-2">
          <FlaskConical size={14} className="text-amber-600" />
          Acceso al Centro de Cría
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Activá o desactivá el módulo Centro de Embriones para cada usuario.
          Los administradores siempre tienen acceso.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-200">
        {usuarios.map((u) => {
          const esAdmin = u.rol === 'admin'
          const isToggling = toggling === u.id
          return (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3 bg-white">
              {/* Avatar */}
              <div className="shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-500">
                {(u.nombre?.[0] ?? '?').toUpperCase()}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">
                  {u.nombre} {u.apellido}
                </p>
                <p className="text-xs text-slate-400 font-mono truncate">{u.email}</p>
              </div>
              {/* Rol badge */}
              <span
                className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${
                  ROL_BADGE[u.rol] ?? 'bg-slate-100 text-slate-500'
                }`}
              >
                {u.rol}
              </span>
              {/* Toggle */}
              {esAdmin ? (
                <div
                  title="El admin siempre tiene acceso"
                  className="shrink-0 flex items-center gap-1 text-xs text-slate-400"
                >
                  <Lock size={12} />
                </div>
              ) : (
                <button
                  onClick={() => handleToggle(u)}
                  disabled={isToggling}
                  className={`shrink-0 relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-40 ${
                    u.tieneAcceso ? 'bg-amber-500' : 'bg-slate-200'
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
