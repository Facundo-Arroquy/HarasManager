import { useEffect, useMemo, useState, useCallback } from 'react'
import { Search, Plus, MapPin, CheckSquare, X } from 'lucide-react'
import { caballoService } from '../../services/caballoService'
import { campoService, type Campo } from '../../services/campoService'
import { useAuthStore } from '../../store/authStore'
import CaballoCard from '../../components/domain/CaballoCard'
import CaballoDetalleModal from '../../components/domain/CaballoDetalleModal'
import NuevaConsultaModal from '../../components/domain/NuevaConsultaModal'
import NuevoCaballoModal from '../../components/domain/NuevoCaballoModal'
import EditarCaballoModal from '../../components/domain/EditarCaballoModal'
import Spinner from '../../components/ui/Spinner'

type Caballo = Awaited<ReturnType<typeof caballoService.listar>>[number]

const CATEGORIAS      = ['Todos', 'Caballo', 'Yegua', 'Padrillo', 'Potrillo']
const CATEGORIAS_EDIT = ['Caballo', 'Yegua', 'Padrillo', 'Potrillo']
const SIN_CAMBIO      = '__sin_cambio__'
const SIN_CAMPO       = '__sin_campo__'

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

  const [showConsulta,   setShowConsulta]   = useState(false)
  const [showNuevo,      setShowNuevo]      = useState(false)
  const [caballoDetalle, setCaballoDetalle] = useState<Caballo | null>(null)
  const [caballoEditar,  setCaballoEditar]  = useState<Caballo | null>(null)

  // ── Selección masiva ────────────────────────────────────────────────────────
  const [modoSeleccion,    setModoSeleccion]    = useState(false)
  const [seleccionados,    setSeleccionados]    = useState<Set<string>>(new Set())
  const [bulkCampoId,      setBulkCampoId]      = useState(SIN_CAMBIO)
  const [bulkCategoria,    setBulkCategoria]    = useState(SIN_CAMBIO)
  const [bulkSubcategoria, setBulkSubcategoria] = useState(SIN_CAMBIO)
  const [bulkSaving,       setBulkSaving]       = useState(false)

  const salirModoSeleccion = useCallback(() => {
    setModoSeleccion(false)
    setSeleccionados(new Set())
    setBulkCampoId(SIN_CAMBIO)
    setBulkCategoria(SIN_CAMBIO)
    setBulkSubcategoria(SIN_CAMBIO)
  }, [])

  const toggleSeleccion = useCallback((id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleTodos = useCallback((ids: string[]) => {
    setSeleccionados((prev) => {
      const todosEstan = ids.every((id) => prev.has(id))
      const next = new Set(prev)
      if (todosEstan) ids.forEach((id) => next.delete(id))
      else ids.forEach((id) => next.add(id))
      return next
    })
  }, [])

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

  // ── Edición masiva ───────────────────────────────────────────────────────────
  const hayBulkCambios =
    bulkCampoId !== SIN_CAMBIO || bulkCategoria !== SIN_CAMBIO || bulkSubcategoria !== SIN_CAMBIO

  async function aplicarEdicionMasiva() {
    if (!hayBulkCambios || seleccionados.size === 0) return
    setBulkSaving(true)
    try {
      const cambios: { campo_id?: string | null; categoria?: string; subcategoria?: string | null } = {}
      if (bulkCampoId !== SIN_CAMBIO)
        cambios.campo_id = bulkCampoId === SIN_CAMPO ? null : bulkCampoId
      if (bulkCategoria !== SIN_CAMBIO)
        cambios.categoria = bulkCategoria
      if (bulkSubcategoria !== SIN_CAMBIO)
        cambios.subcategoria = bulkSubcategoria === '' ? null : bulkSubcategoria
      await caballoService.editarMasivo(Array.from(seleccionados), cambios)
      await cargar()
      salirModoSeleccion()
    } finally {
      setBulkSaving(false)
    }
  }

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
    <div className="p-4 md:p-6 max-w-6xl mx-auto pb-32">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Caballos</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {loading ? '…' : `${caballos.length} animales · ${campos.length} campos`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {rol === 'veterinario' && !modoSeleccion && (
            <button
              onClick={() => setShowConsulta(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors"
            >
              <Plus size={15} /> Nueva consulta
            </button>
          )}
          {canManageCampos(rol) && !modoSeleccion && (
            <button
              onClick={() => setShowNuevo(true)}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 px-3 py-2 text-sm font-medium text-zinc-100 transition-colors"
            >
              <Plus size={15} /> Nuevo caballo
            </button>
          )}
          {canManageCampos(rol) && !modoSeleccion && (
            <button
              onClick={() => setModoSeleccion(true)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 hover:border-zinc-600 px-3 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <CheckSquare size={15} /> Editar en masa
            </button>
          )}
          {modoSeleccion && (
            <button
              onClick={salirModoSeleccion}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <X size={15} /> Cancelar selección
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
        {!modoSeleccion && (
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
        )}
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
              rol={rol}
              onCampoChange={cargar}
              onDetalle={setCaballoDetalle}
              modoSeleccion={modoSeleccion}
              seleccionados={seleccionados}
              onToggle={toggleSeleccion}
              onToggleTodos={toggleTodos}
            />
          ))}
          {sinCampo.length > 0 && (
            <CampoSection
              campo={null}
              caballos={sinCampo}
              rol={rol}
              onCampoChange={cargar}
              onDetalle={setCaballoDetalle}
              modoSeleccion={modoSeleccion}
              seleccionados={seleccionados}
              onToggle={toggleSeleccion}
              onToggleTodos={toggleTodos}
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
      {caballoDetalle && (
        <CaballoDetalleModal
          caballo={caballoDetalle}
          puedeEditar={canManageCampos(rol)}
          onClose={() => setCaballoDetalle(null)}
          onEditar={() => { setCaballoDetalle(null); setCaballoEditar(caballoDetalle) }}
        />
      )}
      {caballoEditar && (
        <EditarCaballoModal
          caballo={caballoEditar}
          onClose={() => setCaballoEditar(null)}
          onSuccess={() => { setCaballoEditar(null); cargar() }}
        />
      )}

      {/* Panel flotante de edición masiva */}
      {modoSeleccion && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-zinc-700 bg-zinc-950/95 backdrop-blur-sm px-4 py-3 md:py-4"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
        >
          <div className="max-w-3xl mx-auto space-y-3">
            {/* Contador */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-300">
                {seleccionados.size === 0
                  ? 'Seleccioná caballos arriba'
                  : `${seleccionados.size} caballo${seleccionados.size > 1 ? 's' : ''} seleccionado${seleccionados.size > 1 ? 's' : ''}`}
              </span>
              {seleccionados.size > 0 && (
                <button
                  onClick={() => setSeleccionados(new Set())}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Controles */}
            <div className="flex flex-wrap gap-2 items-end">
              {/* Campo */}
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1">
                  Campo / Potrero
                </label>
                <select
                  value={bulkCampoId}
                  onChange={(e) => setBulkCampoId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-2 text-sm text-zinc-200 focus:border-emerald-600 focus:outline-none"
                >
                  <option value={SIN_CAMBIO}>— Sin cambio —</option>
                  <option value={SIN_CAMPO}>Sin campo</option>
                  {campos.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Categoría */}
              <div className="flex-1 min-w-[130px]">
                <label className="block text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1">
                  Categoría
                </label>
                <select
                  value={bulkCategoria}
                  onChange={(e) => { setBulkCategoria(e.target.value); if (e.target.value !== 'Yegua') setBulkSubcategoria(SIN_CAMBIO) }}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-2 text-sm text-zinc-200 focus:border-emerald-600 focus:outline-none"
                >
                  <option value={SIN_CAMBIO}>— Sin cambio —</option>
                  {CATEGORIAS_EDIT.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Rol reproductivo (solo si categoria es Yegua o sin cambio para permitir editar yeguas ya filtradas) */}
              <div className="flex-1 min-w-[130px]">
                <label className="block text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1">
                  Rol reproductivo
                </label>
                <select
                  value={bulkSubcategoria}
                  onChange={(e) => setBulkSubcategoria(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-2 text-sm text-zinc-200 focus:border-emerald-600 focus:outline-none"
                >
                  <option value={SIN_CAMBIO}>— Sin cambio —</option>
                  <option value="">Sin especificar</option>
                  <option value="Donante">Donante</option>
                  <option value="Receptora">Receptora</option>
                </select>
              </div>

              {/* Botón aplicar */}
              <button
                onClick={aplicarEdicionMasiva}
                disabled={!hayBulkCambios || seleccionados.size === 0 || bulkSaving}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {bulkSaving ? 'Aplicando…' : 'Aplicar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sección de un campo ───────────────────────────────────────────────────────

interface CampoSectionProps {
  campo: Campo | null
  caballos: Caballo[]
  rol: string | null
  onCampoChange: () => void
  onDetalle: (c: Caballo) => void
  modoSeleccion: boolean
  seleccionados: Set<string>
  onToggle: (id: string) => void
  onToggleTodos: (ids: string[]) => void
}

function CampoSection({
  campo, caballos, rol, onCampoChange, onDetalle,
  modoSeleccion, seleccionados, onToggle, onToggleTodos,
}: CampoSectionProps) {
  const ids            = caballos.map((c) => c.id)
  const todosEnSeccion = ids.every((id) => seleccionados.has(id))

  return (
    <section>
      <div className="flex items-center gap-2 mb-1">
        <MapPin size={14} className={campo ? 'text-emerald-500' : 'text-zinc-600'} />
        <h2 className="text-sm font-semibold text-zinc-300">
          {campo?.nombre ?? 'Sin campo asignado'}
        </h2>
        {campo?.descripcion && (
          <span className="text-xs text-zinc-600">· {campo.descripcion}</span>
        )}
        <span className="ml-auto flex items-center gap-3">
          <span className="text-xs text-zinc-600">
            {caballos.length} animal{caballos.length !== 1 ? 'es' : ''}
          </span>
          {modoSeleccion && (
            <button
              onClick={() => onToggleTodos(ids)}
              className="text-xs text-emerald-500 hover:text-emerald-300 transition-colors"
            >
              {todosEnSeccion ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </button>
          )}
        </span>
      </div>
      {/* Lista compacta */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden divide-y divide-zinc-800">
        {caballos.map((caballo) => (
          <CaballoCard
            key={caballo.id}
            caballo={caballo}
            onClick={() => onDetalle(caballo)}
            seleccionado={modoSeleccion ? seleccionados.has(caballo.id) : undefined}
            onToggle={modoSeleccion ? () => onToggle(caballo.id) : undefined}
          />
        ))}
      </div>
    </section>
  )
}
