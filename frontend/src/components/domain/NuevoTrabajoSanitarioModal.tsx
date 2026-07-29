import { useEffect, useMemo, useState } from 'react'
import { X, AlertCircle, Syringe, Search, MapPin } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { caballoService, type Caballo } from '../../services/caballoService'
import { campoService, type Campo } from '../../services/campoService'
import { sanidadService } from '../../services/sanidadService'
import { nombreCaballo, textoBusquedaCaballo } from '../../utils/caballo'
import { mensajeError } from '../../utils/error'
import type { CatTrabajoSanitario } from '../../types/sanidad'
import Spinner from '../ui/Spinner'

interface Props {
  onClose: () => void
  onSuccess?: () => void
}

const HOY = new Date().toISOString().split('T')[0]
const OTRO = '__otro__'

export default function NuevoTrabajoSanitarioModal({ onClose, onSuccess }: Props) {
  const { user, sociedadActiva } = useAuth()
  const sociedadId = sociedadActiva?.id ?? ''

  const [catalogo, setCatalogo] = useState<CatTrabajoSanitario[]>([])
  const [caballos, setCaballos] = useState<Caballo[]>([])
  const [campos,   setCampos]   = useState<Campo[]>([])
  const [cargando, setCargando] = useState(true)

  // Form
  const [catId,        setCatId]        = useState('')
  const [nombreLibre,  setNombreLibre]  = useState('')
  const [fecha,        setFecha]        = useState(HOY)
  const [tratamiento,  setTratamiento]  = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [busqueda,     setBusqueda]     = useState('')

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  useEffect(() => {
    if (!sociedadId) return
    Promise.all([
      sanidadService.listarCatalogo(sociedadId),
      caballoService.listar(sociedadId),
      campoService.listar(sociedadId),
    ])
      .then(([cat, cabs, camps]) => { setCatalogo(cat); setCaballos(cabs); setCampos(camps) })
      .catch((e) => setError(mensajeError(e, 'Error al cargar datos')))
      .finally(() => setCargando(false))
  }, [sociedadId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const nombreTrabajo = catId === OTRO
    ? nombreLibre.trim()
    : (catalogo.find((c) => c.id === catId)?.nombre ?? '')

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase()
    return caballos
      .filter((c) => textoBusquedaCaballo(c).includes(q))
      .sort((a, b) => nombreCaballo(a).localeCompare(nombreCaballo(b)))
  }, [caballos, busqueda])

  const camposConCaballos = useMemo(() => {
    const ids = new Set(caballos.map((c) => c.campo_id).filter(Boolean))
    return campos.filter((f) => ids.has(f.id)).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [campos, caballos])

  function toggle(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleCampo(campoId: string) {
    const idsCampo = caballos.filter((c) => c.campo_id === campoId).map((c) => c.id)
    setSeleccionados((prev) => {
      const todos = idsCampo.every((id) => prev.has(id))
      const next = new Set(prev)
      if (todos) idsCampo.forEach((id) => next.delete(id))
      else idsCampo.forEach((id) => next.add(id))
      return next
    })
  }

  function toggleTodosVisibles() {
    const ids = filtrados.map((c) => c.id)
    setSeleccionados((prev) => {
      const todos = ids.every((id) => prev.has(id))
      const next = new Set(prev)
      if (todos) ids.forEach((id) => next.delete(id))
      else ids.forEach((id) => next.add(id))
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!nombreTrabajo)          return setError('Elegí o escribí el tipo de trabajo.')
    if (!fecha)                  return setError('La fecha es requerida.')
    if (seleccionados.size === 0) return setError('Seleccioná al menos un caballo.')
    if (!user?.id || !sociedadId) return

    setSaving(true)
    try {
      await sanidadService.crearTrabajo(
        {
          sociedad_id:      sociedadId,
          nombre:           nombreTrabajo,
          fecha_programada: fecha,
          tratamiento:      tratamiento.trim() || null,
          observaciones:    observaciones.trim() || null,
          creado_por:       user.id,
        },
        Array.from(seleccionados),
      )
      onSuccess?.()
      onClose()
    } catch (err) {
      setError(mensajeError(err, 'Error al guardar.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg sm:mx-4 rounded-t-2xl sm:rounded-xl border border-slate-300 bg-white shadow-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <Syringe size={16} className="text-brand-600" />
            <h2 className="text-sm font-semibold text-slate-900">Nuevo trabajo sanitario</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>

        {cargando ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (
          <form id="trabajo-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
            {/* Tipo + Fecha */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Tipo de trabajo *</label>
                <select
                  value={catId}
                  onChange={(e) => setCatId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">— Seleccioná —</option>
                  {catalogo.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  <option value={OTRO}>Otro…</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Fecha *</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            {catId === OTRO && (
              <input
                type="text"
                value={nombreLibre}
                onChange={(e) => setNombreLibre(e.target.value)}
                placeholder="Nombre del trabajo"
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            )}

            {/* Tratamiento + Observaciones */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Tratamiento / producto</label>
              <input
                type="text"
                value={tratamiento}
                onChange={(e) => setTratamiento(e.target.value)}
                placeholder="Ej: Ivermectina 1.87%"
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Observaciones</label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={2}
                placeholder="Notas del trabajo…"
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
              />
            </div>

            {/* Selector de caballos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-500">
                  Caballos ({seleccionados.size} seleccionado{seleccionados.size !== 1 ? 's' : ''})
                </label>
                <button
                  type="button"
                  onClick={toggleTodosVisibles}
                  className="text-xs text-brand-600 hover:text-brand-700"
                >
                  {filtrados.length > 0 && filtrados.every((c) => seleccionados.has(c.id))
                    ? 'Deseleccionar visibles' : 'Seleccionar visibles'}
                </button>
              </div>

              {/* Campos completos */}
              {camposConCaballos.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {camposConCaballos.map((f) => {
                    const idsCampo = caballos.filter((c) => c.campo_id === f.id).map((c) => c.id)
                    const activo = idsCampo.length > 0 && idsCampo.every((id) => seleccionados.has(id))
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => toggleCampo(f.id)}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                          activo
                            ? 'bg-brand-100 text-brand-700 border-brand-300'
                            : 'bg-slate-100 text-slate-500 border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        <MapPin size={11} /> {f.nombre}
                      </button>
                    )
                  })}
                </div>
              )}

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
                      onChange={() => toggle(c.id)}
                      className="rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                    />
                    <span className="text-slate-700">{nombreCaballo(c)}</span>
                    {c.categoria && <span className="ml-auto text-[11px] text-slate-400">{c.categoria}</span>}
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-600">
                <AlertCircle size={13} /> {error}
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
            {saving ? 'Guardando…' : 'Crear trabajo'}
          </button>
        </div>
      </div>
    </div>
  )
}
