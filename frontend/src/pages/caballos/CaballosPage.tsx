import { useEffect, useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { caballoService } from '../../services/caballoService'
import { useAuthStore } from '../../store/authStore'
import CaballoCard from '../../components/domain/CaballoCard'
import NuevaConsultaModal from '../../components/domain/NuevaConsultaModal'
import Spinner from '../../components/ui/Spinner'

type Caballo = Awaited<ReturnType<typeof caballoService.listar>>[number]

const CATEGORIAS = ['Todos', 'Caballo', 'Yegua', 'Padrillo', 'Potrillo']

export default function CaballosPage() {
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const rol        = useAuthStore((s) => s.rol)

  const [caballos,  setCaballos]  = useState<Caballo[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [busqueda,  setBusqueda]  = useState('')
  const [filtro,    setFiltro]    = useState('Todos')
  const [showModal, setShowModal] = useState(false)

  function cargarCaballos() {
    if (!sociedadId) return
    setLoading(true)
    caballoService
      .listar(sociedadId)
      .then(setCaballos)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(cargarCaballos, [sociedadId])

  const filtrados = caballos.filter((c) => {
    const ok = c.nombre.toLowerCase().includes(busqueda.toLowerCase())
    const okCat = filtro === 'Todos' || c.categoria === filtro
    return ok && okCat
  })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Caballos</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {loading ? '…' : `${caballos.length} animales registrados`}
          </p>
        </div>

        {/* Solo veterinario puede crear consultas */}
        {rol === 'veterinario' && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors shrink-0"
          >
            <Plus size={15} />
            Nueva consulta
          </button>
        )}
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

      {/* Estados */}
      {loading && (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      )}
      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950 p-4 text-sm text-red-300">
          Error: {error}
        </div>
      )}
      {!loading && !error && filtrados.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-sm">
          Sin resultados
        </div>
      )}

      {/* Grid */}
      {!loading && !error && filtrados.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map((caballo) => (
            <CaballoCard key={caballo.id} caballo={caballo} />
          ))}
        </div>
      )}

      {/* Modal — sin caballoId pre-seleccionado: muestra selector */}
      {showModal && (
        <NuevaConsultaModal
          onClose={() => setShowModal(false)}
          onSuccess={cargarCaballos}
        />
      )}
    </div>
  )
}
