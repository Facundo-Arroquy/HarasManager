import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, LayoutGrid } from 'lucide-react'
import { caballoService } from '../../services/caballoService'
import { useAuthStore } from '../../store/authStore'
import CaballoCard from '../../components/domain/CaballoCard'
import Spinner from '../../components/ui/Spinner'

type Caballo = Awaited<ReturnType<typeof caballoService.listar>>[number]

const FILTROS_ROL = ['Todos', 'Donante', 'Receptora'] as const
type FiltroRol = typeof FILTROS_ROL[number]

export default function CaballosCentroPage() {
  const navigate   = useNavigate()
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const userId     = useAuthStore((s) => s.user?.id)
  const rol        = useAuthStore((s) => s.rol)
  const esVet      = rol === 'veterinario'

  const [caballos, setCaballos] = useState<Caballo[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState<FiltroRol>('Todos')

  useEffect(() => {
    let vivo = true
    async function cargar() {
      setLoading(true)
      setError(null)
      try {
        const c = esVet
          ? (userId ? await caballoService.listarDelVeterinario(userId) : [])
          : (sociedadId ? await caballoService.listar(sociedadId) : [])
        if (vivo) setCaballos(c)
      } catch (e: unknown) {
        if (vivo) setError((e as any)?.message ?? (e instanceof Error ? e.message : String(e)))
      } finally {
        if (vivo) setLoading(false)
      }
    }
    cargar()
    return () => { vivo = false }
  }, [sociedadId, userId, esVet])

  const reproductivos = useMemo(
    () => caballos.filter((c) => {
      const rolRepro = (c as any).rol_reproductivo as string | null
      return rolRepro === 'Donante' || rolRepro === 'Receptora'
    }),
    [caballos]
  )

  const filtrados = useMemo(() => {
    return reproductivos.filter((c) => {
      const okNombre = c.nombre.toLowerCase().includes(busqueda.toLowerCase())
      const okRol    = filtroRol === 'Todos' || (c as any).rol_reproductivo === filtroRol
      return okNombre && okRol
    })
  }, [reproductivos, busqueda, filtroRol])

  const donantes   = filtrados.filter((c) => (c as any).rol_reproductivo === 'Donante')
  const receptoras = filtrados.filter((c) => (c as any).rol_reproductivo === 'Receptora')

  function irAlDetalle(c: Caballo) {
    navigate(`/caballos/${c.id}/historial`)
  }

  return (
    <div className="space-y-5 p-1">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Caballos Centro</h1>
        <p className="text-sm text-slate-500 mt-0.5">Yeguas donantes y receptoras del centro de embriones</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 focus:border-slate-400 focus:outline-none"
          />
        </div>
        <div className="flex gap-1.5">
          {FILTROS_ROL.map((f) => (
            <button
              key={f}
              onClick={() => setFiltroRol(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filtroRol === f
                  ? 'bg-slate-200 text-slate-900'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}
            >
              {f === 'Todos' ? 'Todos' : `${f}s`}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="flex justify-center py-20"><Spinner size="lg" /></div>}
      {error   && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">Error: {error}</div>}

      {!loading && !error && filtrados.length === 0 && (
        <div className="text-center py-16 text-slate-400 text-sm">
          <LayoutGrid size={28} className="mx-auto mb-2 opacity-30" />
          Sin yeguas donantes o receptoras registradas.
        </div>
      )}

      {!loading && !error && filtrados.length > 0 && (
        <div className="space-y-6">
          {(filtroRol === 'Todos' || filtroRol === 'Donante') && donantes.length > 0 && (
            <GrupoReproductivo titulo="Donantes" caballos={donantes} onDetalle={irAlDetalle} />
          )}
          {(filtroRol === 'Todos' || filtroRol === 'Receptora') && receptoras.length > 0 && (
            <GrupoReproductivo titulo="Receptoras" caballos={receptoras} onDetalle={irAlDetalle} />
          )}
        </div>
      )}
    </div>
  )
}

// ── Grupo por rol reproductivo ────────────────────────────────────────────────

function GrupoReproductivo({
  titulo, caballos, onDetalle,
}: {
  titulo: string
  caballos: Caballo[]
  onDetalle: (c: Caballo) => void
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-sm font-semibold text-slate-600">{titulo}</h2>
        <span className="ml-auto text-xs text-slate-400">
          {caballos.length} animal{caballos.length !== 1 ? 'es' : ''}
        </span>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-200">
        {caballos.map((caballo) => (
          <CaballoCard key={caballo.id} caballo={caballo} onClick={() => onDetalle(caballo)} />
        ))}
      </div>
    </section>
  )
}
