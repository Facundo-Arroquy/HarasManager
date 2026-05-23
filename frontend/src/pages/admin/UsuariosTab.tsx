import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getUsuarios, type UsuarioAdmin } from '../../services/adminService'

const ROL_BADGE: Record<string, string> = {
  admin:       'bg-violet-900/40 text-violet-400',
  veterinario: 'bg-emerald-900/40 text-emerald-400',
  piloto:      'bg-sky-900/40 text-sky-400',
  jugador:     'bg-amber-900/40 text-amber-400',
  peticero:    'bg-rose-900/40 text-rose-400',
}

export default function UsuariosTab() {
  const { sociedadActiva } = useAuth()
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sociedadActiva) return
    getUsuarios(sociedadActiva.id)
      .then(setUsuarios)
      .finally(() => setLoading(false))
  }, [sociedadActiva])

  if (loading) {
    return <p className="text-sm text-zinc-500">Cargando usuarios…</p>
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-zinc-300">
        {usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''}
      </h2>

      {usuarios.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-600">No hay usuarios.</p>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden divide-y divide-zinc-800">
          {usuarios.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3 bg-zinc-900">
              {/* Avatar inicial */}
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
