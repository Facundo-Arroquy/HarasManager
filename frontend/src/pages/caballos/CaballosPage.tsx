import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, CheckSquare, X, FileDown, ChevronDown, LayoutGrid, List } from 'lucide-react'
import Tooltip from '../../components/ui/Tooltip'
import { caballoService } from '../../services/caballoService'
import { campoService, type Campo } from '../../services/campoService'
import { useAuthStore } from '../../store/authStore'
import CaballoCard from '../../components/domain/CaballoCard'
import CaballoGridCard from '../../components/domain/CaballoGridCard'
import CaballoDetalleModal from '../../components/domain/CaballoDetalleModal'
import EditarCaballoModal from '../../components/domain/EditarCaballoModal'
import { tagService, type Tag } from '../../services/tagService'
import { textoBusquedaCaballo, getCamada } from '../../utils/caballo'
import { mensajeError } from '../../utils/error'
import NuevoCaballoModal from '../../components/domain/NuevoCaballoModal'
import ImportarCaballosModal from '../../components/domain/ImportarCaballosModal'
import Spinner from '../../components/ui/Spinner'

type Caballo = Awaited<ReturnType<typeof caballoService.listar>>[number]

const CATEGORIAS      = ['Todos', 'Caballo', 'Yegua', 'Padrillo', 'Potrillo']
const CATEGORIAS_EDIT = ['Caballo', 'Yegua', 'Padrillo', 'Potrillo']
const SIN_CAMBIO      = '__sin_cambio__'
const SIN_CAMPO       = '__sin_campo__'

type Vista = 'grilla' | 'lista'
/** Preferencia de vista del listado, para que sobreviva a la recarga. */
const VISTA_KEY = 'hm_caballos_vista'

function leerVistaGuardada(): Vista {
  try {
    return localStorage.getItem(VISTA_KEY) === 'lista' ? 'lista' : 'grilla'
  } catch {
    return 'grilla'
  }
}

const canManageCampos = (rol: string | null) =>
  rol === 'admin' || rol === 'jugador' || rol === 'piloto'

export default function CaballosPage() {
  const navigate   = useNavigate()
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const userId     = useAuthStore((s) => s.user?.id)
  const rol        = useAuthStore((s) => s.rol)

  const esVet = rol === 'veterinario'

  const [caballos, setCaballos] = useState<Caballo[]>([])
  const [caballosBaja, setCaballosBaja] = useState<Caballo[]>([])
  const [campos,   setCampos]   = useState<Campo[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const [busqueda,         setBusqueda]         = useState('')
  const [filtro,           setFiltro]           = useState('Todos')
  const [soloPreñadas,     setSoloPreñadas]     = useState(false)
  const [verBaja,          setVerBaja]          = useState(false)

  const [filtroEmpresaIds, setFiltroEmpresaIds] = useState<Set<string>>(new Set())
  const [showEmpresaDD,    setShowEmpresaDD]    = useState(false)
  const empresaRef = useRef<HTMLDivElement>(null)

  const [filtroCamposIds,  setFiltroCamposIds]  = useState<Set<string>>(new Set())
  const [showCamposDD,     setShowCamposDD]     = useState(false)
  const camposRef  = useRef<HTMLDivElement>(null)

  const [filtroCamadas,    setFiltroCamadas]    = useState<Set<string>>(new Set())
  const [showCamadas,      setShowCamadas]      = useState(false)
  const camadasRef = useRef<HTMLDivElement>(null)

  const [showNuevo,    setShowNuevo]    = useState(false)
  const [showImportar, setShowImportar] = useState(false)

  // Detalle rápido ("Ver ficha") y edición desde la tarjeta
  const [detalle,  setDetalle]  = useState<Caballo | null>(null)
  const [editando, setEditando] = useState<Caballo | null>(null)

  const puedeEditarCaballo = rol === 'admin' || rol === 'veterinario'

  const [vista, setVista] = useState<Vista>(leerVistaGuardada)

  useEffect(() => {
    try { localStorage.setItem(VISTA_KEY, vista) } catch { /* storage no disponible */ }
  }, [vista])

  // ── Selección masiva ──────────────────────────────────────────────────────
  const [modoSeleccion,    setModoSeleccion]    = useState(false)
  const [seleccionados,    setSeleccionados]    = useState<Set<string>>(new Set())
  const [bulkCampoId,      setBulkCampoId]      = useState(SIN_CAMBIO)
  const [bulkCategoria,    setBulkCategoria]    = useState(SIN_CAMBIO)
  const [bulkSubcategoria, setBulkSubcategoria] = useState(SIN_CAMBIO)
  const [bulkPrenada,      setBulkPrenada]      = useState(SIN_CAMBIO)
  const [bulkSaving,       setBulkSaving]       = useState(false)
  // Tags disponibles (hoy solo "Jugador") y qué hacer con cada uno en la
  // edición masiva: tag_id → SIN_CAMBIO | 'true' (poner) | 'false' (sacar).
  const [tags,     setTags]     = useState<Tag[]>([])
  const [bulkTags, setBulkTags] = useState<Record<number, string>>({})

  const salirModoSeleccion = useCallback(() => {
    setModoSeleccion(false)
    setSeleccionados(new Set())
    setBulkCampoId(SIN_CAMBIO)
    setBulkCategoria(SIN_CAMBIO)
    setBulkSubcategoria(SIN_CAMBIO)
    setBulkPrenada(SIN_CAMBIO)
    setBulkTags({})
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
        // Los campos propios del vet agrupan sus caballos sin sociedad. Los
        // campos de las sociedades donde tiene acceso llegan con cada caballo
        // (`campo_nombre` del RPC), así que no hace falta pedirlos aparte.
        const [c, f] = await Promise.all([
          caballoService.listarDelVeterinario(),
          campoService.listarDelVeterinario(userId).catch(() => [] as Campo[]),
        ])
        setCaballos(c)
        setCampos(f)
      } else {
        if (!sociedadId) return
        const [c, f, baja] = await Promise.all([
          caballoService.listar(sociedadId),
          campoService.listar(sociedadId),
          caballoService.listarDadosDeBaja(sociedadId).catch(() => [] as Caballo[]),
        ])
        setCaballos(c)
        setCampos(f)
        setCaballosBaja(baja)
      }
    } catch (e: unknown) {
      setError(mensajeError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [sociedadId, userId, esVet]) // eslint-disable-line react-hooks/exhaustive-deps

  // El catálogo de tags no depende de la sociedad; si falla, la edición masiva
  // sigue andando sin la columna de tags.
  useEffect(() => {
    tagService.listar().then(setTags).catch(() => setTags([]))
  }, [])

  // Cerrar dropdowns al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (empresaRef.current && !empresaRef.current.contains(e.target as Node)) setShowEmpresaDD(false)
      if (camposRef.current  && !camposRef.current.contains(e.target as Node))  setShowCamposDD(false)
      if (camadasRef.current && !camadasRef.current.contains(e.target as Node)) setShowCamadas(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Edición masiva ────────────────────────────────────────────────────────
  const hayBulkTags = Object.values(bulkTags).some((v) => v !== SIN_CAMBIO)

  const hayBulkCambios =
    bulkCampoId !== SIN_CAMBIO || bulkCategoria !== SIN_CAMBIO ||
    bulkSubcategoria !== SIN_CAMBIO || bulkPrenada !== SIN_CAMBIO || hayBulkTags

  async function aplicarEdicionMasiva() {
    if (!hayBulkCambios || seleccionados.size === 0) return
    setBulkSaving(true)
    setError(null)
    try {
      const cambios: { campo_id?: string | null; categoria?: string; rol_reproductivo?: string | null; prenada?: boolean | null } = {}
      if (bulkCampoId !== SIN_CAMBIO)
        cambios.campo_id = bulkCampoId === SIN_CAMPO ? null : bulkCampoId
      if (bulkCategoria !== SIN_CAMBIO)
        cambios.categoria = bulkCategoria
      if (bulkSubcategoria !== SIN_CAMBIO)
        cambios.rol_reproductivo = bulkSubcategoria === '' ? null : bulkSubcategoria
      if (bulkPrenada !== SIN_CAMBIO)
        cambios.prenada = bulkPrenada === 'true'

      const ids = Array.from(seleccionados)
      // Los tags viven en `caballo_tag`, no en columnas de `caballo`: si el
      // único cambio es un tag, no hay update de la tabla que hacer.
      if (Object.keys(cambios).length > 0) {
        await caballoService.editarMasivo(ids, cambios)
      }
      for (const [tagId, valor] of Object.entries(bulkTags)) {
        if (valor === SIN_CAMBIO) continue
        await tagService.asignarMasivo(ids, Number(tagId), valor === 'true')
      }

      await cargar()
      salirModoSeleccion()
    } catch (e: unknown) {
      // Sin este catch el error se perdía como rejection sin manejar y el panel
      // quedaba abierto como si no hubiera pasado nada.
      setError(mensajeError(e, 'No se pudieron aplicar los cambios'))
    } finally {
      setBulkSaving(false)
    }
  }

  // ── Opciones de filtros ───────────────────────────────────────────────────
  const empresasDisponibles = useMemo(() => {
    if (!esVet) return []
    const mapa: Record<string, string> = {}
    for (const c of caballos) {
      // El RPC get_caballos_veterinario devuelve sociedad_id como ID de empresa
      const id     = c.sociedad_id    as string | null
      const nombre = c.empresa_nombre as string | null
      if (id && nombre && !mapa[id]) mapa[id] = nombre
    }
    return Object.entries(mapa)
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [caballos, esVet])

  // Para vets: cuando cambia empresa filter, limpiar campos que ya no aplican
  useEffect(() => {
    if (!esVet || filtroCamposIds.size === 0) return
    setFiltroCamposIds((prev) => {
      const camposValidos = new Set(
        caballos
          .filter((c) => filtroEmpresaIds.size === 0 || filtroEmpresaIds.has(c.sociedad_id ?? ''))
          .map((c) => c.campo_id as string | null)
          .filter(Boolean)
      )
      const next = new Set([...prev].filter((id) => camposValidos.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [filtroEmpresaIds]) // eslint-disable-line react-hooks/exhaustive-deps

  const camposDisponiblesParaFiltro = useMemo(() => {
    const mapa: Record<string, string> = {}
    // Para vets con empresa seleccionada, mostrar solo campos de esas empresas
    const base = esVet && filtroEmpresaIds.size > 0
      ? caballos.filter((c) => filtroEmpresaIds.has(c.sociedad_id ?? ''))
      : caballos
    for (const c of base) {
      const id     = c.campo_id as string | null
      const nombre = c.campo?.nombre as string | undefined
                  ?? campos.find((f) => f.id === id)?.nombre
      if (id && nombre && !mapa[id]) mapa[id] = nombre
    }
    return Object.entries(mapa)
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [caballos, campos, esVet, filtroEmpresaIds])

  const camadasDisponibles = useMemo(() => {
    const set = new Set<string>()
    for (const c of caballos) {
      const camada = getCamada(c.fecha_nacimiento)
      if (camada) set.add(camada)
    }
    return Array.from(set).sort().reverse()
  }, [caballos])

  // ── Lista filtrada y ordenada A-Z ─────────────────────────────────────────
  const filtradosOrdenados = useMemo(() => {
    // En "Dados de baja" mostramos todos los inactivos (sin las exclusiones de
    // preñadas ni de receptoras, que aplican al listado activo).
    const fuente = verBaja ? caballosBaja : caballos
    // Guarda: nunca listar el mismo caballo dos veces (por si la query devuelve
    // filas repetidas).
    const vistos = new Set<string>()
    const base = fuente.filter((c) => {
      if (vistos.has(c.id)) return false
      vistos.add(c.id)
      return true
    }).filter((c) => {
      const okNombre   = textoBusquedaCaballo(c).includes(busqueda.toLowerCase())
      const okCat      = filtro === 'Todos' || c.categoria === filtro
      const okEmpresa  = filtroEmpresaIds.size === 0 || filtroEmpresaIds.has(c.sociedad_id ?? '')
      const okCampo    = filtroCamposIds.size === 0  || filtroCamposIds.has(c.campo_id ?? '')
      const okCamada   = filtroCamadas.size === 0    || (() => {
        const camada = getCamada(c.fecha_nacimiento)
        return camada !== null && filtroCamadas.has(camada)
      })()
      const okPrenadas = verBaja || !soloPreñadas || (c.prenada === true && c.categoria === 'Yegua')
      // Las yeguas receptoras se gestionan desde "Caballos Centro" (Centro de Embriones)
      const okRol      = verBaja || !(c.categoria === 'Yegua' && c.rol_reproductivo === 'Receptora')
      return okNombre && okCat && okEmpresa && okCampo && okCamada && okPrenadas && okRol
    })
    return base.sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [caballos, caballosBaja, verBaja, busqueda, filtro, filtroEmpresaIds, filtroCamposIds, filtroCamadas, soloPreñadas])

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto pb-32">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            {verBaja ? 'Caballos · Dados de baja' : 'Caballos'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {loading
              ? '…'
              : verBaja
                ? `${caballosBaja.length} dado${caballosBaja.length !== 1 ? 's' : ''} de baja`
                : `${caballos.length} animales registrados`}
          </p>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {rol === 'veterinario' && !modoSeleccion && !verBaja && (
            <button
              onClick={() => setShowNuevo(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 hover:border-slate-400 px-3 py-2 text-sm font-medium text-slate-700 transition-colors"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">Nuevo caballo</span>
            </button>
          )}
          {canManageCampos(rol) && !modoSeleccion && !verBaja && (
            <button
              onClick={() => setShowNuevo(true)}
              className="flex items-center gap-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 px-3 py-2 text-sm font-medium text-slate-900 transition-colors"
              title="Nuevo caballo"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">Nuevo caballo</span>
            </button>
          )}
          {canManageCampos(rol) && !modoSeleccion && !verBaja && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setModoSeleccion(true)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 hover:border-slate-400 px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
              >
                <CheckSquare size={15} />
                <span className="hidden sm:inline">Editar en masa</span>
              </button>
              <Tooltip text="Seleccioná varios caballos y aplicá el mismo campo, categoría o rol reproductivo a todos en un solo paso." />
            </div>
          )}
          {rol === 'admin' && !modoSeleccion && !verBaja && (
            <button
              onClick={() => setShowImportar(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 hover:border-slate-400 px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
              title="Importar caballos por Excel"
            >
              <FileDown size={15} />
              <span className="hidden sm:inline">Importar Excel</span>
            </button>
          )}
          {modoSeleccion && (
            <button
              onClick={salirModoSeleccion}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
            >
              <X size={15} />
              <span className="hidden sm:inline">Cancelar</span>
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-2 mb-5">
        {/* Búsqueda + categoría mobile */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o RP…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 focus:border-slate-400 focus:outline-none"
            />
          </div>
          {!modoSeleccion && (
            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="sm:hidden rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
            >
              {CATEGORIAS.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          )}
          {/* Toggle grilla / lista */}
          <div className="flex shrink-0 items-center rounded-lg border border-slate-300 bg-white p-0.5">
            <button
              onClick={() => setVista('grilla')}
              title="Ver en grilla"
              aria-label="Ver en grilla"
              aria-pressed={vista === 'grilla'}
              className={`rounded-md p-1.5 transition-colors ${
                vista === 'grilla'
                  ? 'bg-slate-200 text-slate-900'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setVista('lista')}
              title="Ver en lista"
              aria-label="Ver en lista"
              aria-pressed={vista === 'lista'}
              className={`rounded-md p-1.5 transition-colors ${
                vista === 'lista'
                  ? 'bg-slate-200 text-slate-900'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {/* Botones de categoría (desktop) */}
        {!modoSeleccion && (
          <div className="hidden sm:flex gap-1.5 flex-wrap">
            {CATEGORIAS.map((cat) => (
              <button
                key={cat}
                onClick={() => setFiltro(cat)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  filtro === cat
                    ? 'bg-slate-200 text-slate-900'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Filtro preñadas + Dados de baja */}
        {!modoSeleccion && (
          <div className="flex items-center gap-2 flex-wrap">
            {!verBaja && (
              <button
                onClick={() => setSoloPreñadas((v) => !v)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border ${
                  soloPreñadas
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                    : 'text-slate-500 border-slate-300 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                <span className={`inline-block w-2 h-2 rounded-full ${soloPreñadas ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                Solo preñadas
              </button>
            )}
            {!esVet && (
              <button
                onClick={() => { setVerBaja((v) => !v); setSoloPreñadas(false) }}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border ${
                  verBaja
                    ? 'bg-rose-100 text-rose-700 border-rose-300'
                    : 'text-slate-500 border-slate-300 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                <span className={`inline-block w-2 h-2 rounded-full ${verBaja ? 'bg-rose-500' : 'bg-slate-300'}`} />
                Dados de baja
              </button>
            )}
          </div>
        )}

        {/* Filtro por empresa — solo veterinarios */}
        {!modoSeleccion && esVet && empresasDisponibles.length > 0 && (
          <FiltroDropdown
            label="Empresa:"
            seleccionados={filtroEmpresaIds}
            opciones={empresasDisponibles}
            show={showEmpresaDD}
            onToggleShow={() => setShowEmpresaDD((v) => !v)}
            onToggleOpcion={(id) =>
              setFiltroEmpresaIds((prev) => {
                const next = new Set(prev)
                if (next.has(id)) { next.delete(id) } else { next.add(id) }
                return next
              })
            }
            onLimpiar={() => setFiltroEmpresaIds(new Set())}
            textoTodos="Todas"
            textoUno={(id) => empresasDisponibles.find((e) => e.id === id)?.nombre ?? '1 empresa'}
            textoMultiple={(n) => `${n} empresas`}
            containerRef={empresaRef}
            minWidth="min-w-[200px]"
          />
        )}

        {/* Filtro por campo */}
        {!modoSeleccion && camposDisponiblesParaFiltro.length > 0 && (
          <FiltroDropdown
            label="Campo:"
            seleccionados={filtroCamposIds}
            opciones={camposDisponiblesParaFiltro}
            show={showCamposDD}
            onToggleShow={() => setShowCamposDD((v) => !v)}
            onToggleOpcion={(id) =>
              setFiltroCamposIds((prev) => {
                const next = new Set(prev)
                if (next.has(id)) { next.delete(id) } else { next.add(id) }
                return next
              })
            }
            onLimpiar={() => setFiltroCamposIds(new Set())}
            textoTodos="Todos"
            textoUno={(id) => camposDisponiblesParaFiltro.find((c) => c.id === id)?.nombre ?? '1 campo'}
            textoMultiple={(n) => `${n} campos`}
            containerRef={camposRef}
            minWidth="min-w-[180px]"
          />
        )}

        {/* Filtro por camada */}
        {!modoSeleccion && camadasDisponibles.length > 0 && (
          <FiltroDropdown
            label="Camada:"
            seleccionados={filtroCamadas}
            opciones={camadasDisponibles.map((c) => ({ id: c, nombre: c }))}
            show={showCamadas}
            onToggleShow={() => setShowCamadas((v) => !v)}
            onToggleOpcion={(id) =>
              setFiltroCamadas((prev) => {
                const next = new Set(prev)
                if (next.has(id)) { next.delete(id) } else { next.add(id) }
                return next
              })
            }
            onLimpiar={() => setFiltroCamadas(new Set())}
            textoTodos="Todas"
            textoUno={(id) => id}
            textoMultiple={(n) => `${n} camadas`}
            containerRef={camadasRef}
            minWidth="min-w-[160px]"
          />
        )}
      </div>

      {loading && <div className="flex justify-center py-20"><Spinner size="lg" /></div>}
      {error   && <div className="rounded-lg border border-red-900 bg-red-950 p-4 text-sm text-red-700">Error: {error}</div>}
      {!loading && !error && filtradosOrdenados.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-sm">Sin resultados</div>
      )}

      {!loading && !error && filtradosOrdenados.length > 0 && (
        <>
          {modoSeleccion && (
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs text-slate-400">{filtradosOrdenados.length} animales</span>
              <button
                onClick={() => toggleTodos(filtradosOrdenados.map((c) => c.id))}
                className="text-xs text-brand-500 hover:text-brand-600 transition-colors"
              >
                {filtradosOrdenados.every((c) => seleccionados.has(c.id))
                  ? 'Deseleccionar todos'
                  : 'Seleccionar todos'}
              </button>
            </div>
          )}
          {vista === 'grilla' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtradosOrdenados.map((caballo) => (
                <CaballoGridCard
                  key={caballo.id}
                  caballo={caballo}
                  onVerFicha={() => setDetalle(caballo)}
                  onHistorial={() => navigate(`/caballos/${caballo.id}/historial`)}
                  seleccionado={modoSeleccion ? seleccionados.has(caballo.id) : undefined}
                  onToggle={modoSeleccion ? () => toggleSeleccion(caballo.id) : undefined}
                  empresaNombre={esVet ? caballo.empresa_nombre ?? undefined : undefined}
                  dadoDeBaja={verBaja}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-200">
              {filtradosOrdenados.map((caballo) => (
                <CaballoCard
                  key={caballo.id}
                  caballo={caballo}
                  onClick={() => navigate(`/caballos/${caballo.id}/historial`)}
                  seleccionado={modoSeleccion ? seleccionados.has(caballo.id) : undefined}
                  onToggle={modoSeleccion ? () => toggleSeleccion(caballo.id) : undefined}
                  empresaNombre={esVet ? caballo.empresa_nombre ?? undefined : undefined}
                />
              ))}
            </div>
          )}
        </>
      )}

      {showImportar && (
        <ImportarCaballosModal
          onClose={() => setShowImportar(false)}
          onSuccess={() => { setShowImportar(false); cargar() }}
        />
      )}
      {showNuevo && (
        <NuevoCaballoModal
          onClose={() => setShowNuevo(false)}
          onSuccess={() => { setShowNuevo(false); cargar() }}
          vetMode={esVet}
        />
      )}
      {detalle && (
        <CaballoDetalleModal
          caballo={detalle}
          puedeEditar={puedeEditarCaballo}
          onClose={() => setDetalle(null)}
          onEditar={() => setEditando(detalle)}
          onRefresh={cargar}
        />
      )}
      {editando && (
        <EditarCaballoModal
          caballo={editando}
          vetMode={esVet}
          onClose={() => setEditando(null)}
          onSuccess={() => { setEditando(null); cargar() }}
        />
      )}

      {/* Panel flotante de edición masiva */}
      {modoSeleccion && (
        <div
          className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-300 bg-white/95 backdrop-blur-sm px-4 py-3 md:py-4"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
        >
          <div className="max-w-3xl mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">
                {seleccionados.size === 0
                  ? 'Seleccioná caballos arriba'
                  : `${seleccionados.size} caballo${seleccionados.size > 1 ? 's' : ''} seleccionado${seleccionados.size > 1 ? 's' : ''}`}
              </span>
              {seleccionados.size > 0 && (
                <button
                  onClick={() => setSeleccionados(new Set())}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Limpiar
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 items-end">
              <div className="sm:flex-1 sm:min-w-[140px]">
                <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">Campo</label>
                <select
                  value={bulkCampoId}
                  onChange={(e) => setBulkCampoId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none"
                >
                  <option value={SIN_CAMBIO}>— Sin cambio —</option>
                  <option value={SIN_CAMPO}>Sin campo</option>
                  {campos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>

              <div className="sm:flex-1 sm:min-w-[130px]">
                <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">Categoría</label>
                <select
                  value={bulkCategoria}
                  onChange={(e) => {
                    setBulkCategoria(e.target.value)
                    // Rol reproductivo y preñez solo aplican a Yeguas
                    if (e.target.value !== 'Yegua') {
                      setBulkSubcategoria(SIN_CAMBIO)
                      setBulkPrenada(SIN_CAMBIO)
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none"
                >
                  <option value={SIN_CAMBIO}>— Sin cambio —</option>
                  {CATEGORIAS_EDIT.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div className="sm:flex-1 sm:min-w-[130px]">
                <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">Rol reprod.</label>
                <select
                  value={bulkSubcategoria}
                  onChange={(e) => setBulkSubcategoria(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none"
                >
                  <option value={SIN_CAMBIO}>— Sin cambio —</option>
                  <option value="">Sin especificar</option>
                  <option value="Donante">Donante</option>
                  <option value="Receptora">Receptora</option>
                </select>
              </div>

              <div className="sm:flex-1 sm:min-w-[120px]">
                <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">Preñada</label>
                <select
                  value={bulkPrenada}
                  onChange={(e) => setBulkPrenada(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none"
                >
                  <option value={SIN_CAMBIO}>— Sin cambio —</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </div>

              {tags.map((tag) => (
                <div key={tag.id} className="sm:flex-1 sm:min-w-[120px]">
                  <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">
                    Tag {tag.nombre}
                  </label>
                  <select
                    value={bulkTags[tag.id] ?? SIN_CAMBIO}
                    onChange={(e) => setBulkTags((prev) => ({ ...prev, [tag.id]: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none"
                  >
                    <option value={SIN_CAMBIO}>— Sin cambio —</option>
                    <option value="true">Poner</option>
                    <option value="false">Sacar</option>
                  </select>
                </div>
              ))}

              <button
                onClick={aplicarEdicionMasiva}
                disabled={!hayBulkCambios || seleccionados.size === 0 || bulkSaving}
                className="col-span-2 sm:col-span-1 rounded-lg bg-brand-500 px-4 py-2.5 sm:py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
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

// ── Dropdown multi-select reutilizable ────────────────────────────────────────

interface FiltroDropdownProps {
  label: string
  seleccionados: Set<string>
  opciones: { id: string; nombre: string }[]
  show: boolean
  onToggleShow: () => void
  onToggleOpcion: (id: string) => void
  onLimpiar: () => void
  textoTodos: string
  textoUno: (id: string) => string
  textoMultiple: (n: number) => string
  containerRef: React.RefObject<HTMLDivElement | null>
  minWidth: string
}

function FiltroDropdown({
  label, seleccionados, opciones, show, onToggleShow, onToggleOpcion, onLimpiar,
  textoTodos, textoUno, textoMultiple, containerRef, minWidth,
}: FiltroDropdownProps) {
  const textoBoton =
    seleccionados.size === 0 ? textoTodos
    : seleccionados.size === 1 ? textoUno(Array.from(seleccionados)[0])
    : textoMultiple(seleccionados.size)

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider shrink-0">{label}</span>
      <div className="relative" ref={containerRef}>
        <button
          onClick={onToggleShow}
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            seleccionados.size > 0
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700'
          }`}
        >
          {textoBoton}
          <ChevronDown size={12} className={`transition-transform ${show ? 'rotate-180' : ''}`} />
        </button>
        {show && (
          <div className={`absolute top-full mt-1 left-0 z-20 ${minWidth} rounded-xl border border-slate-200 bg-white shadow-lg py-1`}>
            {opciones.map((op) => (
              <label
                key={op.id}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={seleccionados.has(op.id)}
                  onChange={() => onToggleOpcion(op.id)}
                  className="rounded border-slate-300"
                />
                {op.nombre}
              </label>
            ))}
          </div>
        )}
      </div>
      {seleccionados.size > 0 && (
        <button
          onClick={onLimpiar}
          className="rounded-lg border border-slate-300 p-1.5 text-slate-400 hover:text-slate-600 hover:border-slate-400 transition-colors"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}
