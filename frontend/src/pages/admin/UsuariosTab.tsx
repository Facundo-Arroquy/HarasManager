import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getUsuarios, type UsuarioAdmin } from '../../services/adminService'

const ROL_BADGE: Record<string, string> = {
  admin:       'bg-violet-100 text-violet-700',
  veterinario: 'bg-amber-100 text-amber-700',
  piloto:      'bg-sky-100 text-sky-700',
  jugador:     'bg-green-100 text-green-700',
  peticero:    'bg-rose-100 text-rose-700',
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
    return <p className="text-sm text-slate-400">Cargando usuarios…</p>
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-slate-600">
        {usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''}
      </h2>

      {usuarios.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No hay usuarios.</p>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-200">
          {usuarios.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3 bg-white">
              {/* Avatar inicial */}
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
