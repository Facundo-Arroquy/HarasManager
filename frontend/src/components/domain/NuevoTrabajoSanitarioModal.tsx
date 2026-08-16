import { useEffect, useMemo, useRef, useState } from 'react'
import { X, AlertCircle, Syringe, Search, MapPin, Building2, Layers, Plus, Trash2, ChevronDown, Stethoscope } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useAuthStore } from '../../store/authStore'
import { caballoService, type Caballo } from '../../services/caballoService'
import { campoService, type Campo } from '../../services/campoService'
import { sanidadService } from '../../services/sanidadService'
import { getVeterinariosPlataforma, type VeterinarioPlataforma } from '../../services/adminService'
import { nombreCaballo, textoBusquedaCaballo, getCamada } from '../../utils/caballo'
import { mensajeError } from '../../utils/error'
import type { CaballoSinAcceso, CatTrabajoSanitario, ItemPlanSanitario } from '../../types/sanidad'
import ConfirmarAccesoVetModal from './ConfirmarAccesoVetModal'
import Spinner from '../ui/Spinner'
import { hoyAR } from '../../utils/fecha'

interface Props {
  onClose: () => void
  onSuccess?: () => void
}

const OTRO = '__otro__'

/** Una línea del plan: un trabajo con su fecha, sobre el mismo grupo de caballos. */
interface FilaTrabajo {
  tempId:      string
  catId:       string
  nombreLibre: string
  fecha:       string
  tratamiento: string
}

let _id = 0
const nuevaFila = (): FilaTrabajo => ({
  tempId: String(++_id), catId: '', nombreLibre: '', fecha: hoyAR(), tratamiento: '',
})

export default function NuevoTrabajoSanitarioModal({ onClose, onSuccess }: Props) {
  const { user, sociedadActiva } = useAuth()
  const rol   = useAuthStore((s) => s.rol)
  const esVet = rol === 'veterinario'
  const sociedadId = sociedadActiva?.id ?? ''

  const [catalogo, setCatalogo] = useState<CatTrabajoSanitario[]>([])
  const [caballos, setCaballos] = useState<Caballo[]>([])
  const [campos,   setCampos]   = useState<Campo[]>([])
  const [cargando, setCargando] = useState(true)

  // Form
  const [filas,         setFilas]         = useState<FilaTrabajo[]>([nuevaFila()])
  const [observaciones, setObservaciones] = useState('')
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())

  // Filtros del selector de caballos (vacío = sin filtrar)
  const [busqueda,       setBusqueda]       = useState('')
  const [filtroEmpresas, setFiltroEmpresas] = useState<Set<string>>(new Set())
  const [filtroCamadas,  setFiltroCamadas]  = useState<Set<string>>(new Set())
  const [filtroCampos,   setFiltroCampos]   = useState<Set<string>>(new Set())

  // Compartir con un veterinario (solo desde el lado de la empresa: un vet que
  // carga su propio plan ya lo ve, no tiene a quién compartírselo).
  const [vets,      setVets]      = useState<VeterinarioPlataforma[]>([])
  const [vetId,     setVetId]     = useState('')
  const [sinAcceso, setSinAcceso] = useState<CaballoSinAcceso[] | null>(null)

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  useEffect(() => {
    if (esVet) return
    getVeterinariosPlataforma()
      .then(setVets)
      .catch(() => setVets([]))   // sin lista, el plan igual se puede crear
  }, [esVet])

  useEffect(() => {
    if (esVet) {
      if (!user?.id) return
      Promise.all([
        sanidadService.listarCatalogoGlobales(),
        caballoService.listarDelVeterinario(),
      ])
        .then(([cat, cabs]) => { setCatalogo(cat); setCaballos(cabs); setCampos([]) })
        .catch((e) => setError(mensajeError(e, 'Error al cargar datos')))
        .finally(() => setCargando(false))
      return
    }
    if (!sociedadId) return
    Promise.all([
      sanidadService.listarCatalogo(sociedadId),
      caballoService.listar(sociedadId),
      campoService.listar(sociedadId),
    ])
      .then(([cat, cabs, camps]) => { setCatalogo(cat); setCaballos(cabs); setCampos(camps) })
      .catch((e) => setError(mensajeError(e, 'Error al cargar datos')))
      .finally(() => setCargando(false))
  }, [sociedadId, esVet, user?.id])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // ── Filas de trabajos ──────────────────────────────────────────────────────

  function updFila(tempId: string, key: keyof FilaTrabajo, val: string) {
    setFilas((prev) => prev.map((f) => f.tempId === tempId ? { ...f, [key]: val } : f))
  }

  function nombreDeFila(f: FilaTrabajo): string {
    return f.catId === OTRO
      ? f.nombreLibre.trim()
      : (catalogo.find((c) => c.id === f.catId)?.nombre ?? '')
  }

  const filasValidas = filas.filter((f) => nombreDeFila(f) !== '' && f.fecha !== '')

  // ── Agrupaciones para los filtros ──────────────────────────────────────────

  const empresas = useMemo(() => {
    if (!esVet) return []
    const map = new Map<string, string>()
    caballos.forEach((c) => {
      if (c.sociedad_id) map.set(c.sociedad_id, c.empresa_nombre ?? 'Sin nombre')
    })
    return [...map.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [caballos, esVet])

  const camadas = useMemo(() => {
    const set = new Set<string>()
    caballos.forEach((c) => {
      const camada = getCamada(c.fecha_nacimiento)
      if (camada) set.add(camada)
    })
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [caballos])

  // Se arma desde los caballos y no desde `campos`: el veterinario no tiene
  // sociedad fija, así que nunca carga el listado de campos, pero sus caballos
  // igual traen el campo en el que están.
  const camposConCaballos = useMemo(() => {
    const map = new Map<string, string>()
    caballos.forEach((c) => {
      if (!c.campo_id) return
      const nombre = c.campo?.nombre ?? campos.find((f) => f.id === c.campo_id)?.nombre
      if (nombre) map.set(c.campo_id, nombre)
    })
    return [...map.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [campos, caballos])

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase()
    return caballos
      .filter((c) => {
        if (!textoBusquedaCaballo(c).includes(q)) return false
        if (filtroEmpresas.size > 0 && !filtroEmpresas.has(c.sociedad_id ?? '')) return false
        if (filtroCampos.size > 0   && !filtroCampos.has(c.campo_id ?? ''))      return false
        if (filtroCamadas.size > 0) {
          const camada = getCamada(c.fecha_nacimiento)
          if (camada === null || !filtroCamadas.has(camada)) return false
        }
        return true
      })
      .sort((a, b) => nombreCaballo(a).localeCompare(nombreCaballo(b)))
  }, [caballos, busqueda, filtroEmpresas, filtroCampos, filtroCamadas])

  function toggleEnSet<T>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, val: T) {
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(val)) next.delete(val)
      else next.add(val)
      return next
    })
  }

  function toggleTodosVisibles() {
    const ids = filtrados.map((c) => c.id)
    setSeleccionados((prev) => {
      const todos = ids.length > 0 && ids.every((id) => prev.has(id))
      const next = new Set(prev)
      if (todos) ids.forEach((id) => next.delete(id))
      else ids.forEach((id) => next.add(id))
      return next
    })
  }

  // ── Resumen de lo que se va a crear ────────────────────────────────────────

  /**
   * Los caballos elegidos, agrupados por dueño: cada grupo es un plan aparte.
   * La clave `''` son los caballos propios del veterinario (`sociedad_id` NULL),
   * que van a un plan con `vet_owner_id` en vez de empresa.
   */
  const gruposPorEmpresa = useMemo(() => {
    const map = new Map<string, string[]>()
    caballos.forEach((c) => {
      if (!seleccionados.has(c.id)) return
      const soc = esVet ? (c.sociedad_id ?? '') : sociedadId
      map.set(soc, [...(map.get(soc) ?? []), c.id])
    })
    return map
  }, [caballos, seleccionados, esVet, sociedadId])

  const totalPlanes = filasValidas.length * gruposPorEmpresa.size

  // ── Guardar ────────────────────────────────────────────────────────────────

  const vetElegido = vets.find((v) => v.id === vetId) ?? null

  /** Los items tal como los espera `crear_plan_sanitario_compartido`. */
  function armarItems(): ItemPlanSanitario[] {
    const items: ItemPlanSanitario[] = []
    for (const fila of filasValidas) {
      for (const [soc, ids] of gruposPorEmpresa) {
        items.push({
          // `null` = plan sobre los caballos propios del vet: la función le pone
          // `vet_owner_id` en vez de empresa.
          sociedad_id:      soc || null,
          nombre:           nombreDeFila(fila),
          fecha_programada: fila.fecha,
          tratamiento:      fila.tratamiento.trim() || null,
          observaciones:    observaciones.trim() || null,
          caballo_ids:      ids,
        })
      }
    }
    return items
  }

  /**
   * Plan + caballos + accesos + notificación salen en una sola transacción del
   * lado de la base: si algo falla no queda nada a medias y no hay que deshacer.
   */
  async function guardar(otorgarAcceso: boolean) {
    setSaving(true)
    try {
      await sanidadService.crearPlanCompartido(armarItems(), vetId || null, otorgarAcceso)
    } catch (err) {
      setError(mensajeError(err, 'Error al guardar.'))
      setSaving(false)
      setSinAcceso(null)
      return
    }
    onSuccess?.()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (filasValidas.length === 0)  return setError('Cargá al menos un trabajo con su fecha.')
    if (seleccionados.size === 0)   return setError('Seleccioná al menos un caballo.')
    if (!user?.id) return
    // El admin siempre trabaja sobre su sociedad activa; si falta, algo se rompió
    // antes de llegar acá. Para el vet, la clave vacía son sus caballos propios y
    // es un caso válido.
    if (!esVet && [...gruposPorEmpresa.keys()].some((soc) => !soc)) {
      return setError('No se pudo determinar la empresa de algunos caballos.')
    }

    // Se pregunta antes de escribir nada: si el admin dice que no, no hay plan
    // que borrar.
    if (vetId) {
      setSaving(true)
      try {
        const faltantes = await sanidadService.caballosSinAcceso(vetId, [...seleccionados])
        if (faltantes.length > 0) {
          setSinAcceso(faltantes)
          setSaving(false)
          return
        }
      } catch (err) {
        setError(mensajeError(err, 'No se pudo verificar el acceso del veterinario.'))
        setSaving(false)
        return
      }
    }

    await guardar(false)
  }

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-2xl sm:mx-4 rounded-t-2xl sm:rounded-xl border border-slate-300 bg-white shadow-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <Syringe size={16} className="text-brand-600" />
            <h2 className="text-sm font-semibold text-slate-900">Nuevo plan sanitario</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>

        {cargando ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (
          <form id="trabajo-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

            {/* Trabajos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-500">Trabajos a programar *</label>
                <button
                  type="button"
                  onClick={() => setFilas((prev) => [...prev, nuevaFila()])}
                  className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
                >
                  <Plus size={13} /> Agregar trabajo
                </button>
              </div>

              <div className="space-y-2">
                {filas.map((f) => (
                  <div key={f.tempId} className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="grid flex-1 grid-cols-1 sm:grid-cols-2 gap-2">
                        <select
                          value={f.catId}
                          onChange={(e) => updFila(f.tempId, 'catId', e.target.value)}
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                          <option value="">— Tipo de trabajo —</option>
                          {catalogo.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                          <option value={OTRO}>Otro…</option>
                        </select>
                        <input
                          type="date"
                          value={f.fecha}
                          onChange={(e) => updFila(f.tempId, 'fecha', e.target.value)}
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                      </div>
                      {filas.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setFilas((prev) => prev.filter((r) => r.tempId !== f.tempId))}
                          className="mt-2 text-slate-400 hover:text-red-600"
                          title="Quitar trabajo"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {f.catId === OTRO && (
                        <input
                          type="text"
                          value={f.nombreLibre}
                          onChange={(e) => updFila(f.tempId, 'nombreLibre', e.target.value)}
                          placeholder="Nombre del trabajo"
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                      )}
                      <input
                        type="text"
                        value={f.tratamiento}
                        onChange={(e) => updFila(f.tempId, 'tratamiento', e.target.value)}
                        placeholder="Tratamiento / producto (opcional)"
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Observaciones */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Observaciones</label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={2}
                placeholder="Se aplican a todos los trabajos del plan…"
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
              />
            </div>

            {/* Compartir con un veterinario */}
            {!esVet && (
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Stethoscope size={12} /> Compartir con un veterinario
                </label>
                <select
                  value={vetId}
                  onChange={(e) => setVetId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">— No compartir —</option>
                  {vets.map((v) => (
                    <option key={v.id} value={v.id}>{v.apellido}, {v.nombre}</option>
                  ))}
                </select>
                {vetId && (
                  <p className="text-[11px] text-slate-400">
                    Va a ver el plan en su panel y va a poder marcarlo como realizado.
                  </p>
                )}
              </div>
            )}

            {/* Selector de caballos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-500">
                  Caballos ({seleccionados.size} seleccionado{seleccionados.size !== 1 ? 's' : ''})
                </label>
                <div className="flex items-center gap-3">
                  {seleccionados.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setSeleccionados(new Set())}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Limpiar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={toggleTodosVisibles}
                    className="text-xs text-brand-600 hover:text-brand-700"
                  >
                    {filtrados.length > 0 && filtrados.every((c) => seleccionados.has(c.id))
                      ? 'Deseleccionar visibles' : 'Seleccionar visibles'}
                  </button>
                </div>
              </div>

              {/* Filtros: empresa / camada / campo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {empresas.length > 0 && (
                  <FiltroDropdown
                    icon={<Building2 size={12} />}
                    seleccion={filtroEmpresas}
                    onToggle={(k) => toggleEnSet(setFiltroEmpresas, k)}
                    onLimpiar={() => setFiltroEmpresas(new Set())}
                    placeholder="Todas las empresas"
                    sustantivo="empresas"
                    items={empresas.map((e) => ({ key: e.id, label: e.nombre }))}
                  />
                )}
                {camadas.length > 0 && (
                  <FiltroDropdown
                    icon={<Layers size={12} />}
                    seleccion={filtroCamadas}
                    onToggle={(k) => toggleEnSet(setFiltroCamadas, k)}
                    onLimpiar={() => setFiltroCamadas(new Set())}
                    placeholder="Todas las camadas"
                    sustantivo="camadas"
                    items={camadas.map((c) => ({ key: c, label: c }))}
                  />
                )}
                {camposConCaballos.length > 0 && (
                  <FiltroDropdown
                    icon={<MapPin size={12} />}
                    seleccion={filtroCampos}
                    onToggle={(k) => toggleEnSet(setFiltroCampos, k)}
                    onLimpiar={() => setFiltroCampos(new Set())}
                    placeholder="Todos los campos"
                    sustantivo="campos"
                    items={camposConCaballos.map((f) => ({ key: f.id, label: f.nombre }))}
                  />
                )}
              </div>

              {/* Búsqueda */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar caballo…"
                  className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {/* Lista */}
              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {filtrados.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-slate-400">Sin caballos.</p>
                ) : filtrados.map((c) => (
                  <label key={c.id} className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={seleccionados.has(c.id)}
                      onChange={() => toggleEnSet(setSeleccionados, c.id)}
                      className="rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                    />
                    <span className="text-slate-700">{nombreCaballo(c)}</span>
                    <span className="ml-auto flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
                      {getCamada(c.fecha_nacimiento) && <span>{getCamada(c.fecha_nacimiento)}</span>}
                      {esVet
                        ? c.empresa_nombre && <span className="truncate max-w-[140px]">{c.empresa_nombre}</span>
                        : c.categoria      && <span>{c.categoria}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Resumen */}
            {totalPlanes > 0 && (
              <p className="rounded-lg bg-brand-50 border border-brand-200 px-3 py-2 text-xs text-brand-700">
                Se crearán <strong>{totalPlanes}</strong> plan{totalPlanes !== 1 ? 'es' : ''} sanitario
                {totalPlanes !== 1 ? 's' : ''}
                {gruposPorEmpresa.size > 1 &&` (${filasValidas.length} trabajo${filasValidas.length !== 1 ? 's' : ''} × ${gruposPorEmpresa.size} empresas)`}
                {' '}sobre {seleccionados.size} caballo{seleccionados.size !== 1 ? 's' : ''}.
              </p>
            )}

            {error && (
              <div className="flex items-start gap-2 text-xs text-red-600">
                <AlertCircle size={13} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}
          </form>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
            Cancelar
          </button>
          <button
            type="submit"
            form="trabajo-form"
            disabled={saving || cargando}
            className="px-4 py-2 text-sm font-medium rounded-md bg-brand-500 hover:bg-brand-400 text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando…' : totalPlanes > 1 ? `Crear ${totalPlanes} planes` : 'Crear plan'}
          </button>
        </div>
      </div>
    </div>

    {sinAcceso && vetElegido && (
      <ConfirmarAccesoVetModal
        vetNombre={`${vetElegido.nombre} ${vetElegido.apellido}`}
        caballos={sinAcceso}
        textoConfirmar={totalPlanes > 1 ? 'Otorgar acceso y crear los planes' : 'Otorgar acceso y crear el plan'}
        saving={saving}
        onConfirmar={() => guardar(true)}
        onCancelar={() => setSinAcceso(null)}
      />
    )}
    </>
  )
}

/**
 * Dropdown de selección múltiple que acota la lista de caballos (empresa,
 * camada, campo). Sin selección = no filtra.
 */
function FiltroDropdown({
  icon, seleccion, onToggle, onLimpiar, placeholder, sustantivo, items,
}: {
  icon: React.ReactNode
  seleccion: Set<string>
  onToggle: (key: string) => void
  onLimpiar: () => void
  placeholder: string
  sustantivo: string
  items: { key: string; label: string }[]
}) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto])

  const activo = seleccion.size > 0
  const texto = seleccion.size === 0
    ? placeholder
    : seleccion.size === 1
      ? (items.find((i) => seleccion.has(i.key))?.label ?? placeholder)
      : `${seleccion.size} ${sustantivo}`

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className={`flex w-full items-center gap-1.5 rounded-md border py-1.5 pl-2.5 pr-2 text-xs transition-colors ${
          activo
            ? 'border-brand-300 bg-brand-50 text-brand-700'
            : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
        }`}
      >
        <span className={activo ? 'text-brand-600' : 'text-slate-400'}>{icon}</span>
        <span className="truncate">{texto}</span>
        <ChevronDown size={13} className={`ml-auto shrink-0 ${activo ? 'text-brand-500' : 'text-slate-400'}`} />
      </button>

      {abierto && (
        <div className="absolute z-20 mt-1 w-full min-w-[11rem] rounded-lg border border-slate-300 bg-white shadow-lg">
          {activo && (
            <button
              type="button"
              onClick={onLimpiar}
              className="w-full border-b border-slate-100 px-3 py-1.5 text-left text-[11px] text-slate-400 hover:text-slate-600"
            >
              Limpiar selección
            </button>
          )}
          <div className="max-h-48 overflow-y-auto py-1">
            {items.map((i) => (
              <label
                key={i.key}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={seleccion.has(i.key)}
                  onChange={() => onToggle(i.key)}
                  className="rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                />
                <span className="truncate">{i.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
