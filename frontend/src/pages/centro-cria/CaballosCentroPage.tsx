import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, LayoutGrid, MapPin, Building2 } from 'lucide-react'
import { caballoService } from '../../services/caballoService'
import { campoService, type Campo } from '../../services/campoService'
import { useAuthStore } from '../../store/authStore'
import CaballoCard from '../../components/domain/CaballoCard'
import EstadoReproductivoPipeline from '../../components/centro-cria/EstadoReproductivoPipeline'
import Spinner from '../../components/ui/Spinner'
import type { EstadoReproductivo } from '../../types/crianza'

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
  const [campos,   setCampos]   = useState<Campo[]>([])
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
        if (esVet) {
          const c = userId ? await caballoService.listarDelVeterinario(userId) : []
          if (vivo) { setCaballos(c); setCampos([]) }
        } else {
          if (!sociedadId) return
          const [c, f] = await Promise.all([
            caballoService.listar(sociedadId),
            campoService.listar(sociedadId),
          ])
          if (vivo) { setCaballos(c); setCampos(f) }
        }
      } catch (e: unknown) {
        if (vivo) setError((e as any)?.message ?? (e instanceof Error ? e.message : String(e)))
      } finally {
        if (vivo) setLoading(false)
      }
    }
    cargar()
    return () => { vivo = false }
  }, [sociedadId, userId, esVet])

  // Solo donantes y receptoras, ordenadas alfabéticamente (el servicio ya las trae con .order('nombre'))
  const filtrados = useMemo(() => {
    return caballos
      .filter((c) => {
        const rolRepro = (c as any).rol_reproductivo as string | null
        const esReproductivo = rolRepro === 'Donante' || rolRepro === 'Receptora'
        if (!esReproductivo) return false
        const okNombre = c.nombre.toLowerCase().includes(busqueda.toLowerCase())
        const okRol    = filtroRol === 'Todos' || rolRepro === filtroRol
        return okNombre && okRol
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [caballos, busqueda, filtroRol])

  // Agrupado por campo (vista empresa) o por empresa (vista veterinario)
  const gruposPorCampo = useMemo(() => {
    const byCampo: Record<string, Caballo[]> = {}
    for (const c of filtrados) {
      const key = (c as any).campo_id ?? '__sin_campo__'
      if (!byCampo[key]) byCampo[key] = []
      byCampo[key].push(c)
    }
    return byCampo
  }, [filtrados])

  const gruposPorEmpresa = useMemo(() => {
    const byEmpresa: Record<string, { nombre: string; caballos: Caballo[] }> = {}
    for (const c of filtrados) {
      const id     = (c as any).empresa_id     ?? (c as any).sociedad_id ?? 'desconocida'
      const nombre = (c as any).empresa_nombre ?? id
      if (!byEmpresa[id]) byEmpresa[id] = { nombre, caballos: [] }
      byEmpresa[id].caballos.push(c)
    }
    return Object.entries(byEmpresa).sort(([, a], [, b]) => a.nombre.localeCompare(b.nombre))
  }, [filtrados])

  const camposConCaballos = [...campos]
    .filter((c) => gruposPorCampo[c.id]?.length)
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
  const sinCampo = gruposPorCampo['__sin_campo__'] ?? []

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
        <div className="space-y-8">
          {/* Veterinario: agrupado por empresa */}
          {esVet && gruposPorEmpresa.map(([empresaId, { nombre, caballos: cabs }]) => (
            <GrupoSection
              key={empresaId}
              titulo={nombre}
              icono={<Building2 size={14} className="text-sky-500" />}
              caballos={cabs}
              onDetalle={irAlDetalle}
            />
          ))}

          {/* Admin/jugador/piloto: agrupado por campo */}
          {!esVet && (
            <>
              {camposConCaballos.map((campo) => (
                <GrupoSection
                  key={campo.id}
                  titulo={campo.nombre}
                  subtitulo={campo.descripcion}
                  icono={<MapPin size={14} className="text-brand-500" />}
                  caballos={gruposPorCampo[campo.id]}
                  onDetalle={irAlDetalle}
                />
              ))}
              {sinCampo.length > 0 && (
                <GrupoSection
                  titulo="Sin campo asignado"
                  icono={<MapPin size={14} className="text-slate-400" />}
                  caballos={sinCampo}
                  onDetalle={irAlDetalle}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sección agrupada (por campo o por empresa) ────────────────────────────────

function GrupoSection({
  titulo, subtitulo, icono, caballos, onDetalle,
}: {
  titulo: string
  subtitulo?: string | null
  icono: React.ReactNode
  caballos: Caballo[]
  onDetalle: (c: Caballo) => void
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-1">
        {icono}
        <h2 className="text-sm font-semibold text-slate-600">{titulo}</h2>
        {subtitulo && <span className="text-xs text-slate-400">· {subtitulo}</span>}
        <span className="ml-auto text-xs text-slate-400">
          {caballos.length} animal{caballos.length !== 1 ? 'es' : ''}
        </span>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-200">
        {caballos.map((caballo) => {
          const rolRepro = (caballo as any).rol_reproductivo as 'Donante' | 'Receptora' | null
          const estadoRepro = (caballo as any).estado_reproductivo as EstadoReproductivo
          return (
            <div key={caballo.id} className="divide-y divide-slate-100">
              <CaballoCard caballo={caballo} onClick={() => onDetalle(caballo)} />
              {rolRepro && (
                <EstadoReproductivoPipeline
                  rol={rolRepro}
                  estado={estadoRepro ?? null}
                />
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
