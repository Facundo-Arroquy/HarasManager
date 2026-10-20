import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, Search, X } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { caballoService, type Caballo } from '../../services/caballoService'
import { mensajeError } from '../../utils/error'
import Spinner from '../../components/ui/Spinner'
import NombreCaballoLink from '../../components/domain/NombreCaballoLink'

// ── Tipos auxiliares ────────────────────────────────────────────────────────

interface HijoRow {
  id: string
  nombre: string
  fecha_nacimiento: string | null
  categoria: string
  sexo: string | null
  activo: boolean
  rol_reproductivo: string | null
  cat_raza?: { nombre: string } | null
  cat_pelaje?: { nombre: string } | null
  campo?: { nombre: string } | null
  padre?: { id: string; nombre: string } | null
  madre?: { id: string; nombre: string } | null
}

function formatFecha(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y.slice(2)}`
}

const VACIO = <span className="text-slate-300">—</span>

// ── Componente principal ────────────────────────────────────────────────────

export default function DescendenciaPage() {
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const rol        = useAuthStore((s) => s.rol)

  const [caballos, setCaballos]       = useState<Caballo[]>([])
  const [loadingCab, setLoadingCab]   = useState(true)

  const [seleccionado, setSeleccionado] = useState<Caballo | null>(null)
  const [busqueda, setBusqueda]         = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const [hijos, setHijos]           = useState<HijoRow[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [filtro, setFiltro]         = useState<string | null>(null)

  // Cargar caballos al montar
  useEffect(() => {
    setLoadingCab(true)
    const promesa = rol === 'veterinario' && !sociedadId
      ? caballoService.listarDelVeterinario()
      : sociedadId
        ? caballoService.listar(sociedadId)
        : Promise.resolve([])
    promesa
      .then(setCaballos)
      .catch((e) => setError(mensajeError(e)))
      .finally(() => setLoadingCab(false))
  }, [sociedadId, rol])

  const resultados = useMemo(() => {
    if (!busqueda.trim()) return []
    const term = busqueda.toLowerCase()
    return caballos
      .filter((c) => c.nombre.toLowerCase().includes(term))
      .slice(0, 15)
  }, [caballos, busqueda])

  const cargarDatos = useCallback((cab: Caballo) => {
    setSeleccionado(cab)
    setBusqueda(cab.nombre)
    setDropdownOpen(false)
    setLoadingData(true)
    setError(null)
    setFiltro(null)

    caballoService.listarDescendencia(cab.id)
      .then((data) => setHijos(data as unknown as HijoRow[]))
      .catch((e) => setError(mensajeError(e)))
      .finally(() => setLoadingData(false))
  }, [])

  const limpiar = () => {
    setSeleccionado(null)
    setBusqueda('')
    setHijos([])
    setError(null)
    setFiltro(null)
    inputRef.current?.focus()
  }

  // Determinar si es padre o madre (o ambos) en los resultados
  const esPadre = seleccionado && hijos.some((h) => h.padre?.id === seleccionado.id)
  const esMadre = seleccionado && hijos.some((h) => h.madre?.id === seleccionado.id)

  // Resumen rápido
  const resumen = useMemo(() => {
    if (!seleccionado || hijos.length === 0) return null
    const porCategoria = new Map<string, number>()
    let activos = 0
    for (const h of hijos) {
      porCategoria.set(h.categoria, (porCategoria.get(h.categoria) ?? 0) + 1)
      if (h.activo) activos++
    }
    return { total: hijos.length, activos, porCategoria: Array.from(porCategoria.entries()).sort((a, b) => b[1] - a[1]) }
  }, [seleccionado, hijos])

  const hijosFiltrados = useMemo(() => {
    if (!filtro) return hijos
    if (filtro === 'activos') return hijos.filter((h) => h.activo)
    return hijos.filter((h) => h.categoria === filtro)
  }, [hijos, filtro])

  function toggleFiltro(key: string) {
    setFiltro((prev) => prev === key ? null : key)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="text-brand-600" size={24} />
        <h1 className="text-xl font-semibold">Descendencia</h1>
      </div>

      {/* Buscador */}
      <div className="relative max-w-md">
        <label htmlFor="buscar-progenitor" className="sr-only">Buscar caballo</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            ref={inputRef}
            id="buscar-progenitor"
            type="text"
            placeholder={loadingCab ? 'Cargando caballos...' : 'Buscar padrillo, yegua o caballo...'}
            disabled={loadingCab}
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value)
              setDropdownOpen(true)
              if (seleccionado) setSeleccionado(null)
            }}
            onFocus={() => { if (busqueda && !seleccionado) setDropdownOpen(true) }}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
          {busqueda && (
            <button type="button" onClick={limpiar} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600" aria-label="Limpiar búsqueda">
              <X size={14} />
            </button>
          )}
        </div>

        {dropdownOpen && resultados.length > 0 && !seleccionado && (
          <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {resultados.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => cargarDatos(c)}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-brand-50 focus:bg-brand-50 focus:outline-none"
                >
                  <span className="font-medium">{c.nombre}</span>
                  <span className="ml-2 text-xs text-slate-400">{c.categoria}{c.rol_reproductivo ? ` · ${c.rol_reproductivo}` : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {dropdownOpen && busqueda.trim() && resultados.length === 0 && !seleccionado && !loadingCab && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-center text-sm text-slate-400 shadow-lg">
            Sin resultados para &quot;{busqueda}&quot;
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loadingData && (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      )}

      {!seleccionado && !loadingData && (
        <div className="rounded-lg border border-dashed border-slate-200 py-16 text-center text-slate-400">
          Buscá un caballo para ver sus hijos registrados
        </div>
      )}

      {seleccionado && !loadingData && (
        <div className="space-y-6">
          {/* Subtítulo con rol */}
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <NombreCaballoLink id={seleccionado.id} nombre={seleccionado.nombre} className="font-semibold text-slate-800" />
            <span>·</span>
            <span>{seleccionado.categoria}</span>
            {esPadre && esMadre && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">Padre y madre</span>}
            {esPadre && !esMadre && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Padre</span>}
            {esMadre && !esPadre && <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-700">Madre</span>}
          </div>

          {/* Cards resumen — clickeables como filtro */}
          {resumen && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Total hijos" value={resumen.total} active={filtro === null} onClick={() => setFiltro(null)} />
              <StatCard label="Activos" value={resumen.activos} active={filtro === 'activos'} onClick={() => toggleFiltro('activos')} />
              {resumen.porCategoria.map(([cat, n]) => (
                <StatCard key={cat} label={cat + 's'} value={n} active={filtro === cat} onClick={() => toggleFiltro(cat)} />
              ))}
            </div>
          )}

          {/* Indicador de filtro activo */}
          {filtro && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              Mostrando {hijosFiltrados.length} de {hijos.length}
              <button type="button" onClick={() => setFiltro(null)} className="text-brand-600 underline hover:text-brand-700">
                Ver todos
              </button>
            </div>
          )}

          {/* Tabla de hijos */}
          {hijosFiltrados.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Nombre</th>
                    <th className="px-4 py-2">Categoría</th>
                    <th className="px-4 py-2">Sexo</th>
                    <th className="px-4 py-2">Nacimiento</th>
                    <th className="px-4 py-2">Raza</th>
                    <th className="px-4 py-2">Pelaje</th>
                    <th className="px-4 py-2">Padre</th>
                    <th className="px-4 py-2">Madre</th>
                    <th className="px-4 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hijosFiltrados.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium">
                        <NombreCaballoLink id={h.id} nombre={h.nombre} />
                      </td>
                      <td className="px-4 py-2">{h.categoria}</td>
                      <td className="px-4 py-2">{h.sexo === 'H' ? 'Hembra' : h.sexo === 'M' ? 'Macho' : VACIO}</td>
                      <td className="whitespace-nowrap px-4 py-2">
                        {h.fecha_nacimiento ? formatFecha(h.fecha_nacimiento) : VACIO}
                      </td>
                      <td className="px-4 py-2">{h.cat_raza?.nombre ?? VACIO}</td>
                      <td className="px-4 py-2">{h.cat_pelaje?.nombre ?? VACIO}</td>
                      <td className="px-4 py-2">
                        {h.padre
                          ? <NombreCaballoLink id={h.padre.id} nombre={h.padre.nombre} />
                          : VACIO}
                      </td>
                      <td className="px-4 py-2">
                        {h.madre
                          ? <NombreCaballoLink id={h.madre.id} nombre={h.madre.nombre} />
                          : VACIO}
                      </td>
                      <td className="px-4 py-2">
                        {h.activo
                          ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Activo</span>
                          : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Baja</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : hijos.length > 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
              No hay hijos que coincidan con el filtro
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
              No se encontraron hijos registrados para este caballo
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, active, onClick }: { label: string; value: number | string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-4 text-left transition-colors ${
        active
          ? 'border-brand-400 bg-brand-50 ring-1 ring-brand-400'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </button>
  )
}
