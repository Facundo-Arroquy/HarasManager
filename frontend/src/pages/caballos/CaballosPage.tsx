import { useEffect, useMemo, useState } from 'react'
import { Search, Plus, MapPin } from 'lucide-react'
import { caballoService } from '../../services/caballoService'
import { campoService, type Campo } from '../../services/campoService'
import { useAuthStore } from '../../store/authStore'
import CaballoCard from '../../components/domain/CaballoCard'
import NuevaConsultaModal from '../../components/domain/NuevaConsultaModal'
import NuevoCaballoModal from '../../components/domain/NuevoCaballoModal'
import EditarCaballoModal from '../../components/domain/EditarCaballoModal'
import Spinner from '../../components/ui/Spinner'

type Caballo = Awaited<ReturnType<typeof caballoService.listar>>[number]

const CATEGORIAS = ['Todos', 'Caballo', 'Yegua', 'Padrillo', 'Potrillo']

const canManageCampos = (rol: string | null) =>
  rol === 'admin' || rol === 'jugador' || rol === 'piloto'

export default function CaballosPage() {
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const rol        = useAuthStore((s) => s.rol)

  const [caballos, setCaballos] = useState<Caballo[]>([])
  const [campos,   setCampos]   = useState<Campo[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtro,   setFiltro]   = useState('Todos')

  const [showConsulta,  setShowConsulta]  = useState(false)
  const [showNuevo,     setShowNuevo]     = useState(false)
  const [caballoEditar, setCaballoEditar] = useState<Caballo | null>(null)

  async function cargar() {
    if (!sociedadId) return
    setLoading(true)
    try {
      const [c, f] = await Promise.all([
        caballoService.listar(sociedadId),
        campoService.listar(sociedadId),
      ])
      setCaballos(c)
      setCampos(f)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [sociedadId]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtrados = useMemo(
    () =>
      caballos.filter((c) => {
        const okNombre = c.nombre.toLowerCase().includes(busqueda.toLowerCase())
        const okCat    = filtro === 'Todos' || c.categoria === filtro
        return okNombre && okCat
      }),
    [caballos, busqueda, filtro]
  )

  const grupos = useMemo(() => {
    const byCampo: Record<string, Caballo[]> = {}
    for (const c of filtrados) {
      const key = (c as any).campo_id ?? '__sin_campo__'
      if (!byCampo[key]) byCampo[key] = []
      byCampo[key].push(c)
    }
    return byCampo
  }, [filtrados])

  const camposConCaballos = campos.filter((c) => grupos[c.id]?.length)
  const sinCampo          = grupos['__sin_campo__'] ?? []

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Caballos</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {loading ? '…' : `${caballos.length} animales · ${campos.length} campos`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {rol === 'veterinario' && (
            <button
              onClick={() => setShowConsulta(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors"
            >
              <Plus size={15} /> Nueva consulta
            </button>
          )}
          {canManageCampos(rol) && (
            <button
              onClick={() => setShowNuevo(true)}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 px-3 py-2 text-sm font-medium text-zinc-100 transition-colors"
            >
              <Plus size={15} /> Nuevo caballo
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por nombre…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIAS.map((cat) => (
            <button
              key={cat}
              onClick={() => setFiltro(cat)}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                filtro === cat
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="flex justify-center py-20"><Spinner size="lg" /></div>}
      {error   && <div className="rounded-lg border border-red-900 bg-red-950 p-4 text-sm text-red-300">Error: {error}</div>}
      {!loading && !error && filtrados.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-sm">Sin resultados</div>
      )}

      {!loading && !error && filtrados.length > 0 && (
        <div className="space-y-8">
          {camposConCaballos.map((campo) => (
            <CampoSection
              key={campo.id}
              campo={campo}
              caballos={grupos[campo.id]}
              todos={campos}
              rol={rol}
              onEditar={setCaballoEditar}
              onCampoChange={cargar}
            />
          ))}
          {sinCampo.length > 0 && (
            <CampoSection
              campo={null}
              caballos={sinCampo}
              todos={campos}
              rol={rol}
              onEditar={setCaballoEditar}
              onCampoChange={cargar}
            />
          )}
        </div>
      )}

      {showConsulta && (
        <NuevaConsultaModal onClose={() => setShowConsulta(false)} onSuccess={cargar} />
      )}
      {showNuevo && (
        <NuevoCaballoModal
          onClose={() => setShowNuevo(false)}
          onSuccess={() => { setShowNuevo(false); cargar() }}
        />
      )}
      {caballoEditar && (
        <EditarCaballoModal
          caballo={caballoEditar}
          onClose={() => setCaballoEditar(null)}
          onSuccess={() => { setCaballoEditar(null); cargar() }}
        />
      )}
    </div>
  )
}

// ── Sección de un campo ───────────────────────────────────────────────────────

interface CampoSectionProps {
  campo: Campo | null
  caballos: Caballo[]
  todos: Campo[]
  rol: string | null
  onEditar: (c: Caballo) => void
  onCampoChange: () => void
}

function CampoSection({ campo, caballos, todos, rol, onEditar, onCampoChange }: CampoSectionProps) {
  const puedeGestionar = canManageCampos(rol)

  async function handleCampoChange(caballoId: string, nuevoId: string) {
    await campoService.asignarCaballo(caballoId, nuevoId || null)
    onCampoChange()
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <MapPin size={14} className={campo ? 'text-emerald-500' : 'text-zinc-600'} />
        <h2 className="text-sm font-semibold text-zinc-300">
          {campo?.nombre ?? 'Sin campo asignado'}
        </h2>
        {campo?.descripcion && (
          <span className="text-xs text-zinc-600">· {campo.descripcion}</span>
        )}
        <span className="ml-auto text-xs text-zinc-600">
          {caballos.length} animal{caballos.length !== 1 ? 'es' : ''}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {caballos.map((caballo) => (
          <CaballoCard
            key={caballo.id}
            caballo={caballo}
            onEditar={puedeGestionar ? () => onEditar(caballo) : undefined}
            campos={puedeGestionar ? todos : []}
            onCampoChange={puedeGestionar ? (nuevoId) => handleCampoChange(caballo.id, nuevoId) : undefined}
          />
        ))}
      </div>
    </section>
  )
}
