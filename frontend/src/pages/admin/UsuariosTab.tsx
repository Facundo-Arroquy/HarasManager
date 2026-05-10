import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getUsuarios, type UsuarioAdmin } from '../../services/adminService'
import { MOCK_MARCAS } from '../../dev/mockData'

const ROL_BADGE: Record<string, string> = {
  admin:       'bg-violet-900/40 text-violet-400',
  veterinario: 'bg-emerald-900/40 text-emerald-400',
  piloto:      'bg-sky-900/40 text-sky-400',
  jugador:     'bg-amber-900/40 text-amber-400',
  peticero:    'bg-rose-900/40 text-rose-400',
}

function marcaNombre(marcaId: string | null): string {
  if (!marcaId) return '—'
  return MOCK_MARCAS.find((m) => m.id === marcaId)?.nombre ?? marcaId
}

export default function UsuariosTab() {
  const { sociedadActiva, marcaId: miMarcaId } = useAuth()
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sociedadActiva) return
    getUsuarios(sociedadActiva.id)
      .then((data) => {
        // Admin de marca solo ve usuarios de su propia marca
        if (miMarcaId) {
          setUsuarios(data.filter((u) => u.marcaId === miMarcaId))
        } else {
          setUsuarios(data)
        }
      })
      .finally(() => setLoading(false))
  }, [sociedadActiva, miMarcaId])

  if (loading) {
    return <p className="text-sm text-zinc-500">Cargando usuarios…</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-300">
          {usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''}
        </h2>
      </div>

      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900">
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Nombre</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Rol</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Marca</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {usuarios.map((u) => (
              <tr key={u.id} className="hover:bg-zinc-900/50 transition-colors">
                <td className="px-4 py-3">
                  <span className="font-medium text-zinc-200">
                    {u.nombre} {u.apellido}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-zinc-400 text-xs font-mono">{u.email}</span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                      ROL_BADGE[u.rol] ?? 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {u.rol}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-zinc-400 text-xs truncate">
                    {marcaNombre(u.marcaId)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {usuarios.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-zinc-600">No hay usuarios.</p>
        )}
      </div>
    </div>
  )
}
