import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, MailCheck, MailX, Search } from 'lucide-react'
import { superAdminService, type ActividadUsuario } from '../../services/superAdminService'
import Spinner from '../../components/ui/Spinner'

type Filtro = 'todos' | 'sin_confirmar' | 'sin_actividad'

function formatFecha(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

/** "hace 3 días" / "hace 2 h". El listado se lee de un vistazo, la fecha exacta va en el title. */
function hace(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1)   return 'recién'
  if (min < 60)  return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24)    return `hace ${h} h`
  const d = Math.floor(h / 24)
  if (d < 30)    return `hace ${d} d`
  const meses = Math.floor(d / 30)
  return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`
}

export default function ActividadTab() {
  const [filas, setFilas]     = useState<ActividadUsuario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [filtro, setFiltro]   = useState<Filtro>('todos')
  const [busqueda, setBusqueda] = useState('')

  async function cargar() {
    setLoading(true)
    setError('')
    try {
      setFilas(await superAdminService.listarActividad())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la actividad.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const sinConfirmar = filas.filter((f) => !f.email_confirmado).length
  const sinActividad = filas.filter((f) => !f.ultima_accion).length

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return filas
      .filter((f) => {
        if (filtro === 'sin_confirmar') return !f.email_confirmado
        if (filtro === 'sin_actividad') return !f.ultima_accion
        return true
      })
      .filter((f) => {
        if (!q) return true
        const nombre = `${f.nombre ?? ''} ${f.apellido ?? ''}`.toLowerCase()
        return f.email.toLowerCase().includes(q) || nombre.includes(q)
      })
  }, [filas, filtro, busqueda])

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>

  return (
    <div className="space-y-4">
      {/* Encabezado + filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {([
            ['todos',         `Todos (${filas.length})`],
            ['sin_confirmar', `Sin confirmar (${sinConfirmar})`],
            ['sin_actividad', `Sin actividad (${sinActividad})`],
          ] as [Filtro, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFiltro(id)}
              className={`rounded px-3 py-1.5 text-xs font-medium border transition-colors ${
                filtro === id
                  ? 'bg-zinc-700 border-zinc-500 text-zinc-100'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o email"
              className="w-56 rounded border border-zinc-700 bg-zinc-900 py-1.5 pl-8 pr-3 text-xs text-zinc-200 placeholder-zinc-600 focus:border-emerald-600 focus:outline-none"
            />
          </div>
          <button
            onClick={cargar}
            className="flex items-center gap-1.5 rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          >
            <RefreshCw size={13} />
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-900/50 bg-red-950/40 px-4 py-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-xs">
          <thead className="bg-zinc-900 text-zinc-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Usuario</th>
              <th className="px-4 py-2.5 text-left font-medium">Rol</th>
              <th className="px-4 py-2.5 text-left font-medium">Email confirmado</th>
              <th className="px-4 py-2.5 text-left font-medium">Último ingreso</th>
              <th className="px-4 py-2.5 text-left font-medium">Última acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {visibles.map((f) => (
              <tr key={f.usuario_id} className="hover:bg-zinc-900/60">
                <td className="px-4 py-2.5">
                  <div className="text-zinc-200">
                    {[f.nombre, f.apellido].filter(Boolean).join(' ') || '—'}
                  </div>
                  <div className="text-[11px] text-zinc-500">{f.email}</div>
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-zinc-400">{f.rol ?? '—'}</span>
                  {!f.activo && (
                    <span className="ml-1.5 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
                      inactivo
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {f.email_confirmado ? (
                    <span
                      className="inline-flex items-center gap-1.5 text-emerald-400"
                      title={`Confirmado el ${formatFecha(f.email_confirmado_at)}`}
                    >
                      <MailCheck size={13} />
                      {formatFecha(f.email_confirmado_at)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-amber-400">
                      <MailX size={13} />
                      Pendiente
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-zinc-400" title={formatFecha(f.ultimo_login)}>
                  {hace(f.ultimo_login)}
                </td>
                <td className="px-4 py-2.5">
                  {f.ultima_accion ? (
                    <>
                      <div className="text-zinc-300">{f.ultima_accion}</div>
                      <div className="text-[11px] text-zinc-500" title={formatFecha(f.ultima_accion_at)}>
                        {hace(f.ultima_accion_at)}
                      </div>
                    </>
                  ) : (
                    <span className="text-zinc-600">Sin registros</span>
                  )}
                </td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-zinc-600">
                  No hay usuarios que coincidan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] leading-relaxed text-zinc-600">
        <strong className="text-zinc-500">Sobre "última acción":</strong> el sistema no lleva un log de
        auditoría. Se muestra el registro más reciente que el usuario haya <em>creado</em> (historial
        clínico, planes sanitarios, tags, torneos, ventas, accesos a veterinarios, propiedades y
        movimientos del centro de cría). Alguien que entra, navega y consulta sin cargar nada aparece
        como "sin registros" aunque haya usado la app — para ese caso mirá el último ingreso.
      </p>
    </div>
  )
}
