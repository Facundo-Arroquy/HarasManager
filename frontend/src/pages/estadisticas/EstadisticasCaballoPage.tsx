import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, Search, X } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { caballoService, type Caballo } from '../../services/caballoService'
import { crianzaService } from '../../services/crianzaService'
import type { EmbrionConSeguimiento, EstadoEmbrion, Flushing, ResultadoEcografia } from '../../types/crianza'
import { mensajeError } from '../../utils/error'
import Spinner from '../../components/ui/Spinner'
import NombreCaballoLink from '../../components/domain/NombreCaballoLink'

// ── Badges (reutilizados de EmbrionesPage) ──────────────────────────────────

const ESTADO_LABEL: Record<EstadoEmbrion, string> = {
  disponible:  'Disponible',
  transferido: 'Transferido',
  congelado:   'Vitrificado',
  en_nube:     'En nube',
  descartado:  'Descartado',
}

const ESTADO_BADGE: Record<EstadoEmbrion, string> = {
  disponible:  'bg-emerald-100 text-emerald-700',
  transferido: 'bg-blue-100    text-blue-700',
  congelado:   'bg-cyan-100    text-cyan-700',
  en_nube:     'bg-violet-100  text-violet-700',
  descartado:  'bg-slate-100   text-slate-500',
}

const ECO_BADGE: Record<ResultadoEcografia, string> = {
  prenada:             'bg-emerald-100 text-emerald-700',
  abortada:            'bg-red-100     text-red-700',
  pendiente:           'bg-amber-100   text-amber-700',
  vacia:               'bg-slate-100   text-slate-600',
  volver_a_ver:        'bg-yellow-100  text-yellow-700',
  vacia_resincronizar: 'bg-orange-100  text-orange-700',
}

const ECO_LABEL: Record<ResultadoEcografia, string> = {
  prenada:             'Preñada',
  abortada:            'Abortada',
  pendiente:           'Revisar',
  vacia:               'Vacía',
  volver_a_ver:        'Volver a ver',
  vacia_resincronizar: 'Vacía – resincronizar',
}

function formatFecha(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y.slice(2)}`
}

const VACIO = <span className="text-slate-300">—</span>

// ── Helpers de cálculo ──────────────────────────────────────────────────────

function calcResumen(flushings: Flushing[], embriones: EmbrionConSeguimiento[]) {
  const flushPositivos = flushings.filter((f) => !f.es_negativo && !f.cancelado).length
  const flushNegativos = flushings.filter((f) => f.es_negativo && !f.cancelado).length

  const porEstado: Record<EstadoEmbrion, number> = {
    disponible: 0, transferido: 0, congelado: 0, en_nube: 0, descartado: 0,
  }
  for (const e of embriones) porEstado[e.estado]++

  const transferidos = embriones.filter((e) => e.estado === 'transferido')
  const conEco1 = transferidos.filter((e) => {
    const t = e.cria_transferencia?.[0]
    return t?.cria_ecografia?.some((eco) => eco.numero === 1)
  })
  const prenadas = conEco1.filter((e) => {
    const t = e.cria_transferencia?.[0]
    return t?.cria_ecografia?.some((eco) => eco.numero === 1 && eco.resultado === 'prenada')
  })

  return {
    totalFlushings: flushings.filter((f) => !f.cancelado).length,
    flushPositivos,
    flushNegativos,
    totalEmbriones: embriones.length,
    porEstado,
    tasaPrenez: conEco1.length > 0
      ? Math.round((prenadas.length / conEco1.length) * 100)
      : null,
    prenadas: prenadas.length,
    conEco1: conEco1.length,
  }
}

interface FilaPadrillo {
  padrilloId: string | null
  padrilloNombre: string
  total: number
  transferidos: number
  prenadas: number
  vacias: number
}

function calcPorPadrillo(embriones: EmbrionConSeguimiento[]): FilaPadrillo[] {
  const map = new Map<string, FilaPadrillo>()
  for (const e of embriones) {
    const key = e.padrillo_id ?? '__sin_padrillo__'
    if (!map.has(key)) {
      map.set(key, {
        padrilloId: e.padrillo_id,
        padrilloNombre: e.padrillo?.nombre ?? 'Sin padrillo',
        total: 0, transferidos: 0, prenadas: 0, vacias: 0,
      })
    }
    const fila = map.get(key)!
    fila.total++
    if (e.estado === 'transferido') {
      fila.transferidos++
      const t = e.cria_transferencia?.[0]
      const eco1 = t?.cria_ecografia?.find((eco) => eco.numero === 1)
      if (eco1?.resultado === 'prenada') fila.prenadas++
      else if (eco1 && eco1.resultado !== 'pendiente' && eco1.resultado !== 'volver_a_ver') fila.vacias++
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

interface FilaTransferido {
  embrion: EmbrionConSeguimiento
  transferencia: NonNullable<EmbrionConSeguimiento['cria_transferencia']>[0]
}

function calcTransferidos(embriones: EmbrionConSeguimiento[]): FilaTransferido[] {
  const filas: FilaTransferido[] = []
  for (const e of embriones) {
    const t = e.cria_transferencia?.[0]
    if (t) filas.push({ embrion: e, transferencia: t })
  }
  return filas.sort((a, b) => b.transferencia.fecha.localeCompare(a.transferencia.fecha))
}

// ── Componente principal ────────────────────────────────────────────────────

export default function EstadisticasCaballoPage() {
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const rol        = useAuthStore((s) => s.rol)

  // Lista de caballos para el buscador
  const [caballos, setCaballos]       = useState<Caballo[]>([])
  const [loadingCab, setLoadingCab]   = useState(true)

  // Selección
  const [seleccionado, setSeleccionado] = useState<Caballo | null>(null)
  const [busqueda, setBusqueda]         = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Datos del caballo seleccionado
  const [flushings, setFlushings]   = useState<Flushing[]>([])
  const [embriones, setEmbriones]   = useState<EmbrionConSeguimiento[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError]           = useState<string | null>(null)

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

  // Filtro local de búsqueda
  const resultados = useMemo(() => {
    if (!busqueda.trim()) return []
    const term = busqueda.toLowerCase()
    return caballos
      .filter((c) => c.nombre.toLowerCase().includes(term))
      .slice(0, 15)
  }, [caballos, busqueda])

  // Cargar datos al seleccionar
  const cargarDatos = useCallback((cab: Caballo) => {
    setSeleccionado(cab)
    setBusqueda(cab.nombre)
    setDropdownOpen(false)
    setLoadingData(true)
    setError(null)

    Promise.all([
      crianzaService.listarFlushingsPorCaballo(cab.id),
      crianzaService.listarEmbrionesPorDonante(cab.id),
    ])
      .then(([f, e]) => { setFlushings(f); setEmbriones(e) })
      .catch((e) => setError(mensajeError(e)))
      .finally(() => setLoadingData(false))
  }, [])

  const limpiar = () => {
    setSeleccionado(null)
    setBusqueda('')
    setFlushings([])
    setEmbriones([])
    setError(null)
    inputRef.current?.focus()
  }

  // Datos calculados
  const resumen       = useMemo(() => seleccionado ? calcResumen(flushings, embriones) : null, [seleccionado, flushings, embriones])
  const porPadrillo   = useMemo(() => calcPorPadrillo(embriones), [embriones])
  const transferidos  = useMemo(() => calcTransferidos(embriones), [embriones])

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="text-brand-600" size={24} />
        <h1 className="text-xl font-semibold">Estadísticas reproductivas</h1>
      </div>

      {/* Buscador */}
      <div className="relative max-w-md">
        <label htmlFor="buscar-caballo" className="sr-only">Buscar caballo</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            ref={inputRef}
            id="buscar-caballo"
            type="text"
            placeholder={loadingCab ? 'Cargando caballos...' : 'Buscar yegua / donante...'}
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
            <button
              type="button"
              onClick={limpiar}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
              aria-label="Limpiar búsqueda"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Dropdown de resultados */}
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

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Loading */}
      {loadingData && (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      )}

      {/* Sin selección */}
      {!seleccionado && !loadingData && (
        <div className="rounded-lg border border-dashed border-slate-200 py-16 text-center text-slate-400">
          Buscá un caballo para ver sus estadísticas reproductivas
        </div>
      )}

      {/* Contenido */}
      {seleccionado && !loadingData && resumen && (
        <div className="space-y-8">
          {/* ── Cards de resumen ───────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Flushings" value={resumen.totalFlushings} sub={`${resumen.flushPositivos} pos / ${resumen.flushNegativos} neg`} />
            <StatCard label="Embriones" value={resumen.totalEmbriones} />
            <StatCard label="Transferidos" value={resumen.porEstado.transferido} />
            <StatCard label="Vitrificados" value={resumen.porEstado.congelado + resumen.porEstado.en_nube} />
            <StatCard
              label="Tasa de preñez"
              value={resumen.tasaPrenez !== null ? `${resumen.tasaPrenez}%` : '—'}
              sub={resumen.conEco1 > 0 ? `${resumen.prenadas}/${resumen.conEco1}` : 'Sin eco 1'}
            />
          </div>

          {/* ── Embriones por estado ───────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ESTADO_LABEL) as EstadoEmbrion[]).map((est) => (
              <span key={est} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${ESTADO_BADGE[est]}`}>
                {ESTADO_LABEL[est]}: {resumen.porEstado[est]}
              </span>
            ))}
          </div>

          {/* ── Tabla: Embriones por padrillo ──────────────────────────────── */}
          {porPadrillo.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Embriones por padrillo</h2>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Padrillo</th>
                      <th className="px-4 py-2 text-center">Total</th>
                      <th className="px-4 py-2 text-center">Transferidos</th>
                      <th className="px-4 py-2 text-center">Preñadas</th>
                      <th className="px-4 py-2 text-center">Vacías</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {porPadrillo.map((f) => (
                      <tr key={f.padrilloId ?? 'none'} className="hover:bg-slate-50">
                        <td className="px-4 py-2">
                          <NombreCaballoLink id={f.padrilloId} nombre={f.padrilloNombre} />
                        </td>
                        <td className="px-4 py-2 text-center font-medium">{f.total}</td>
                        <td className="px-4 py-2 text-center">{f.transferidos}</td>
                        <td className="px-4 py-2 text-center text-emerald-600 font-medium">{f.prenadas}</td>
                        <td className="px-4 py-2 text-center text-slate-500">{f.vacias}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Tabla: Detalle de embriones transferidos ───────────────────── */}
          {transferidos.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Detalle de embriones transferidos</h2>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Fecha extr.</th>
                      <th className="px-3 py-2">Padrillo</th>
                      <th className="px-3 py-2">Receptora</th>
                      <th className="px-3 py-2">Fecha transf.</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2 text-center">Eco 1</th>
                      <th className="px-3 py-2 text-center">Eco 2</th>
                      <th className="px-3 py-2 text-center">Eco 3</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transferidos.map(({ embrion, transferencia }) => {
                      const ecos = transferencia.cria_ecografia ?? []
                      return (
                        <tr key={embrion.id} className="hover:bg-slate-50">
                          <td className="whitespace-nowrap px-3 py-2">
                            {embrion.fecha_extraccion ? formatFecha(embrion.fecha_extraccion) : VACIO}
                          </td>
                          <td className="px-3 py-2">
                            <NombreCaballoLink id={embrion.padrillo_id} nombre={embrion.padrillo?.nombre} />
                          </td>
                          <td className="px-3 py-2">
                            <NombreCaballoLink
                              id={transferencia.caballo_receptora_id}
                              nombre={transferencia.receptora?.nombre}
                            />
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">
                            {formatFecha(transferencia.fecha)}
                          </td>
                          <td className="px-3 py-2">
                            {transferencia.clasificacion === 'Fresco'
                              ? <span className="text-emerald-600 text-xs font-medium">Fresco</span>
                              : transferencia.clasificacion === 'Congelado'
                                ? <span className="text-cyan-600 text-xs font-medium">Vitrificado</span>
                                : VACIO}
                          </td>
                          {[1, 2, 3].map((n) => {
                            const eco = ecos.find((e) => e.numero === n)
                            return (
                              <td key={n} className="px-3 py-2 text-center">
                                {eco
                                  ? <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ECO_BADGE[eco.resultado]}`}>
                                      {ECO_LABEL[eco.resultado]}
                                    </span>
                                  : VACIO}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Sin datos */}
          {embriones.length === 0 && flushings.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
              Este caballo no tiene registros de flushing ni embriones
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Card de resumen ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}
