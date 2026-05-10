import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getMarcas, type MarcaAdmin } from '../../services/adminService'

export default function MarcasTab() {
  const { sociedadActiva } = useAuth()
  const [marcas, setMarcas] = useState<MarcaAdmin[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sociedadActiva) return
    getMarcas(sociedadActiva.id)
      .then(setMarcas)
      .finally(() => setLoading(false))
  }, [sociedadActiva])

  if (loading) {
    return <p className="text-sm text-zinc-500">Cargando marcas…</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-300">
          {marcas.length} marca{marcas.length !== 1 ? 's' : ''} registrada{marcas.length !== 1 ? 's' : ''}
        </h2>
      </div>

      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900">
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Marca</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Dominio</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider">Caballos</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {marcas.map((marca) => (
              <tr key={marca.id} className="hover:bg-zinc-900/50 transition-colors">
                <td className="px-4 py-3">
                  <span className="font-medium text-zinc-200">{marca.nombre}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                    @{marca.dominio_email}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-zinc-300 font-medium">{marca.caballos_count}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                      marca.activa
                        ? 'bg-emerald-900/40 text-emerald-400'
                        : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${marca.activa ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                    {marca.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {marcas.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-zinc-600">No hay marcas registradas.</p>
        )}
      </div>
    </div>
  )
}
