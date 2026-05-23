import { useEffect, useMemo, useState, useCallback } from 'react'
import { Search, Plus, MapPin, CheckSquare, X, Building2, LayoutList } from 'lucide-react'
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
type VistaVet = 'empresa' | 'campo'

const VISTA_KEY       = 'haras_vista_caballos_vet'
const CATEGORIAS      = ['Todos', 'Caballo', 'Yegua', 'Padrillo', 'Potrillo']
const CATEGORIAS_EDIT = ['Caballo', 'Yegua', 'Padrillo', 'Potrillo']
const SIN_CAMBIO      = '__sin_cambio__'
const SIN_CAMPO       = '__sin_campo__'

const canManageCampos = (rol: string | null) =>
  rol === 'admin' || rol === 'jugador' || rol === 'piloto'

export default function CaballosPage() {
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const userId     = useAuthStore((s) => s.user?.id)
  const rol        = useAuthStore((s) => s.rol)

  const esVet = rol === 'veterinario'

  const [vistaVet, setVistaVet] = useState<VistaVet>(
    () => (localStorage.getItem(VISTA_KEY) as VistaVet) ?? 'empresa'
  )

  const [caballos, setCaballos] = useState<Caballo[]>([])
  const [campos,   setCampos]   = useState<Campo[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [busqueda,    setBusqueda]    = useState('')
  const [filtro,      setFiltro]      = useState('Todos')
  const [ordenSubcat, setOrdenSubcat] = useState<'ninguno' | 'receptoras' | 'donantes'>('ninguno')

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
    setLoading(true)
    try {
      if (esVet && userId) {
        const c = await caballoService.listarDelVeterinario(userId)
        setCaballos(c)
        setCampos([]) // vets ven agrupado por empresa o campo sin necesitar la lista de campos
      } else {
        if (!sociedadId) return
        const [c, f] = await Promise.all([
          caballoService.listar(sociedadId),
          campoService.listar(sociedadId),
        ])
        setCaballos(c)
        setCampos(f)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [sociedadId, userId, esVet]) // eslint-disable-line react-hooks/exhaustive-deps

  function cambiarVistaVet(v: VistaVet) {
    setVistaVet(v)
    localStorage.setItem(VISTA_KEY, v)
  }

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

  const ORDEN_SUBCAT: Record<string, Record<string, number>> = {
    receptoras: { Receptora: 0, Donante: 1 },
    donantes:   { Donante: 0, Receptora: 1 },
  }

  const filtrados = useMemo(() => {
    const base = caballos.filter((c) => {
      const okNombre = c.nombre.toLowerCase().includes(busqueda.toLowerCase())
      const okCat    = filtro === 'Todos' || c.categoria === filtro
      return okNombre && okCat
    })
    if (ordenSubcat === 'ninguno') return base
    const orden = ORDEN_SUBCAT[ordenSubcat]
    return [...base].sort((a, b) => {
      const pa = orden[(a as any).subcategoria ?? ''] ?? 2
      const pb = orden[(b as any).subcategoria ?? ''] ?? 2
      return pa - pb
    })
  }, [caballos, busqueda, filtro, ordenSubcat]) // eslint-disable-line react-hooks/exhaustive-deps

  const grupos = useMemo(() => {
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
    return byEmpresa
  }, [filtrados])

  const camposConCaballos = campos.filter((c) => grupos[c.id]?.length)
  const sinCampo          = grupos['__sin_campo__'] ?? []

  // Para vista vet por campo: construimos campos únicos a partir de los caballos
  const camposVet = useMemo(() => {
    if (!esVet) return []
    const mapa: Record<string, { id: string; nombre: string; descripcion?: string }> = {}
    for (const c of filtrados) {
      const id     = (c as any).campo_id
      const nombre = (c as any).campo?.nombre
      if (id && nombre && !mapa[id]) mapa[id] = { id, nombre }
    }
    return Object.values(mapa)
  }, [filtrados, esVet])

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto pb-32">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">Caballos</h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            {loading ? '…' : esVet
              ? `${caballos.length} animales · ${Object.keys(gruposPorEmpresa).length} empresa${Object.keys(gruposPorEmpresa).length !== 1 ? 's' : ''}`
              : `${caballos.length} animales · ${campos.length} campos`
            }
          </p>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {rol === 'veterinario' && !modoSeleccion && (
            <button
              onClick={() => setShowConsulta(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">Nueva consulta</span>
            </button>
          )}
          {canManageCampos(rol) && !modoSeleccion && (
            <button
              onClick={() => setShowNuevo(true)}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 px-3 py-2 text-sm font-medium text-zinc-100 transition-colors"
              title="Nuevo caballo"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">Nuevo caballo</span>
            </button>
          )}
          {canManageCampos(rol) && !modoSeleccion && (
            <button
              onClick={() => setModoSeleccion(true)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 hover:border-zinc-600 px-3 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Editar en masa"
            >
              <CheckSquare size={15} />
              <span className="hidden sm:inline">Editar en masa</span>
            </button>
          )}
          {modoSeleccion && (
            <button
              onClick={salirModoSeleccion}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <X size={15} />
              <span className="hidden sm:inline">Cancelar</span>
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-2 mb-5">
        {/* Búsqueda + categoría en la misma fila */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none"
            />
          </div>
          {/* Categoría: select en mobile, botones en sm+ */}
          {!modoSeleccion && (
            <>
              <select
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="sm:hidden rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-200 focus:border-zinc-600 focus:outline-none"
              >
                {CATEGORIAS.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              {/* Vista vet toggle — móvil: select; desktop: botones */}
              {esVet && (
                <select
                  value={vistaVet}
                  onChange={(e) => cambiarVistaVet(e.target.value as VistaVet)}
                  className="sm:hidden rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-200 focus:border-zinc-600 focus:outline-none"
                >
                  <option value="empresa">Por empresa</option>
                  <option value="campo">Por campo</option>
                </select>
              )}
            </>
          )}
        </div>

        {/* Fila extra en sm+: botones de categoría + vista vet + orden */}
        {!modoSeleccion && (
          <div className="hidden sm:flex items-center gap-3 flex-wrap">
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIAS.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFiltro(cat)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    filtro === cat
                      ? 'bg-zinc-700 text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Toggle vista vet (desktop) */}
            {esVet && (
              <div className="flex rounded-lg border border-zinc-700 overflow-hidden text-xs font-medium ml-auto">
                <button
                  onClick={() => cambiarVistaVet('empresa')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                    vistaVet === 'empresa' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  <Building2 size={13} /> Por empresa
                </button>
                <button
                  onClick={() => cambiarVistaVet('campo')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border-l border-zinc-700 transition-colors ${
                    vistaVet === 'campo' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  <LayoutList size={13} /> Por campo
                </button>
              </div>
            )}
          </div>
        )}

        {/* Orden por rol reproductivo: select en mobile, botones en sm+ */}
        {!modoSeleccion && (
          <div className="flex items-center gap-2">
            {/* Mobile: select */}
            <select
              value={ordenSubcat}
              onChange={(e) => setOrdenSubcat(e.target.value as typeof ordenSubcat)}
              className="sm:hidden flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-zinc-600 focus:outline-none"
            >
              <option value="ninguno">Orden: por defecto</option>
              <option value="receptoras">Receptoras primero</option>
              <option value="donantes">Donantes primero</option>
            </select>
            {/* Desktop: botones */}
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Orden:</span>
              {(['ninguno', 'receptoras', 'donantes'] as const).map((op) => (
                <button
                  key={op}
                  onClick={() => setOrdenSubcat(op)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    ordenSubcat === op ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                  }`}
                >
                  {op === 'ninguno' ? 'Por defecto' : op === 'receptoras' ? 'Receptoras primero' : 'Donantes primero'}
                </button>
              ))}
            </div>
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
          {/* Vista veterinario por empresa */}
          {esVet && vistaVet === 'empresa' && Object.entries(gruposPorEmpresa).map(([empresaId, { nombre, caballos: cabs }]) => (
            <EmpresaSection
              key={empresaId}
              empresaNombre={nombre}
              caballos={cabs}
              onDetalle={setCaballoDetalle}
              modoSeleccion={modoSeleccion}
              seleccionados={seleccionados}
              onToggle={toggleSeleccion}
              onToggleTodos={toggleTodos}
            />
          ))}

          {/* Vista veterinario por campo */}
          {esVet && vistaVet === 'campo' && (
            <>
              {camposVet.map((campo) => (
                <CampoSection
                  key={campo.id}
                  campo={campo as Campo}
                  caballos={grupos[campo.id] ?? []}
                  rol={rol}
                  onCampoChange={cargar}
                  onDetalle={setCaballoDetalle}
                  modoSeleccion={modoSeleccion}
                  seleccionados={seleccionados}
                  onToggle={toggleSeleccion}
                  onToggleTodos={toggleTodos}
                  mostrarEmpresa
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
                  mostrarEmpresa
                />
              )}
            </>
          )}

          {/* Vista admin/jugador/piloto: por campo de la sociedad */}
          {!esVet && (
            <>
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
            </>
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

            {/* Controles — grid 2 cols en mobile, fila en desktop */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 items-end">
              {/* Campo */}
              <div className="sm:flex-1 sm:min-w-[140px]">
                <label className="block text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1">
                  Campo
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
              <div className="sm:flex-1 sm:min-w-[130px]">
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

              {/* Rol reproductivo */}
              <div className="sm:flex-1 sm:min-w-[130px]">
                <label className="block text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1">
                  Rol reprod.
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

              {/* Botón aplicar — full width en mobile (ocupa las 2 cols) */}
              <button
                onClick={aplicarEdicionMasiva}
                disabled={!hayBulkCambios || seleccionados.size === 0 || bulkSaving}
                className="col-span-2 sm:col-span-1 rounded-lg bg-emerald-700 px-4 py-2.5 sm:py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
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
  mostrarEmpresa?: boolean
}

function CampoSection({
  campo, caballos, onDetalle,
  modoSeleccion, seleccionados, onToggle, onToggleTodos,
  mostrarEmpresa,
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
            empresaNombre={mostrarEmpresa ? (caballo as any).empresa_nombre : undefined}
          />
        ))}
      </div>
    </section>
  )
}

// ── Sección de empresa (vista vet) ────────────────────────────────────────────

interface EmpresaSectionProps {
  empresaNombre: string
  caballos: Caballo[]
  onDetalle: (c: Caballo) => void
  modoSeleccion: boolean
  seleccionados: Set<string>
  onToggle: (id: string) => void
  onToggleTodos: (ids: string[]) => void
}

function EmpresaSection({
  empresaNombre, caballos, onDetalle,
  modoSeleccion, seleccionados, onToggle, onToggleTodos,
}: EmpresaSectionProps) {
  const ids            = caballos.map((c) => c.id)
  const todosEnSeccion = ids.every((id) => seleccionados.has(id))

  return (
    <section>
      <div className="flex items-center gap-2 mb-1">
        <Building2 size={14} className="text-sky-500" />
        <h2 className="text-sm font-semibold text-zinc-300">{empresaNombre}</h2>
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
