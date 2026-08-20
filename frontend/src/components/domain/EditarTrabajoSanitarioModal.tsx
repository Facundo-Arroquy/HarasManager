import { useEffect, useMemo, useState } from 'react'
import { X, AlertCircle, Pencil, Search, Trash2 } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { caballoService, type Caballo } from '../../services/caballoService'
import { sanidadService } from '../../services/sanidadService'
import { nombreCaballo, textoBusquedaCaballo } from '../../utils/caballo'
import { mensajeError } from '../../utils/error'
import type { CatTrabajoSanitario, TrabajoSanitario } from '../../types/sanidad'
import Spinner from '../ui/Spinner'

interface Props {
  /** Trabajo pendiente a corregir. Uno solo: cada fecha del plan es su fila. */
  trabajo:   TrabajoSanitario
  /** Se ofrece borrarlo desde el mismo modal. */
  onEliminar?: () => void
  onClose:   () => void
  onSuccess: () => void
}

const OTRO = '__otro__'

/**
 * Corrige un trabajo sanitario que todavía no se hizo: qué es, cuándo, con qué
 * y sobre qué caballos. No toca `compartido_con` — eso se cambia desde
 * "Compartir", que además resuelve los accesos del veterinario.
 */
export default function EditarTrabajoSanitarioModal({ trabajo, onEliminar, onClose, onSuccess }: Props) {
  const rol   = useAuthStore((s) => s.rol)
  const esVet = rol === 'veterinario'

  const [catalogo, setCatalogo] = useState<CatTrabajoSanitario[]>([])
  const [caballos, setCaballos] = useState<Caballo[]>([])
  const [cargando, setCargando] = useState(true)

  const [catId,         setCatId]         = useState('')
  const [nombreLibre,   setNombreLibre]   = useState(trabajo.nombre)
  const [fecha,         setFecha]         = useState(trabajo.fecha_programada)
  const [tratamiento,   setTratamiento]   = useState(trabajo.tratamiento ?? '')
  const [observaciones, setObservaciones] = useState(trabajo.observaciones ?? '')
  const [seleccionados, setSeleccionados] = useState<Set<string>>(
    () => new Set((trabajo.caballos ?? []).map((c) => c.caballo_id)),
  )
  const [busqueda, setBusqueda] = useState('')

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, saving])

  useEffect(() => {
    // El universo de caballos es el del dueño del trabajo: la empresa, o los
    // propios del veterinario cuando el plan no tiene sociedad.
    const pedirCaballos = esVet
      ? caballoService.listarDelVeterinario()
          .then((cabs) => cabs.filter((c) => (c.sociedad_id ?? null) === trabajo.sociedad_id))
      : caballoService.listar(trabajo.sociedad_id ?? '')

    Promise.all([
      esVet ? sanidadService.listarCatalogoGlobales() : sanidadService.listarCatalogo(trabajo.sociedad_id ?? ''),
      pedirCaballos,
    ])
      .then(([cat, cabs]) => {
        setCatalogo(cat)
        setCaballos(cabs)
        const match = cat.find((c) => c.nombre === trabajo.nombre)
        setCatId(match ? match.id : OTRO)
      })
      .catch((e) => setError(mensajeError(e, 'Error al cargar datos')))
      .finally(() => setCargando(false))
  }, [esVet, trabajo.sociedad_id, trabajo.nombre])

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase()
    return caballos
      .filter((c) => textoBusquedaCaballo(c).includes(q))
      .sort((a, b) => nombreCaballo(a).localeCompare(nombreCaballo(b)))
  }, [caballos, busqueda])

  /**
   * Los caballos del trabajo que no aparecen en el listado (dados de baja, o
   * fuera del alcance de quien edita). Se muestran igual para que quede claro
   * que siguen en el plan y se puedan sacar.
   */
  const fueraDeLista = useMemo(() => {
    const conocidos = new Set(caballos.map((c) => c.id))
    return (trabajo.caballos ?? [])
      .filter((c) => !conocidos.has(c.caballo_id) && seleccionados.has(c.caballo_id))
      .map((c) => ({ id: c.caballo_id, nombre: c.caballo ? nombreCaballo(c.caballo) : c.caballo_id }))
  }, [caballos, trabajo.caballos, seleccionados])

  const nombreFinal = catId === OTRO
    ? nombreLibre.trim()
    : (catalogo.find((c) => c.id === catId)?.nombre ?? '')

  function toggle(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!nombreFinal)            return setError('Poné el nombre del trabajo.')
    if (!fecha)                  return setError('Elegí la fecha.')
    if (seleccionados.size === 0) return setError('Dejá al menos un caballo, o eliminá el trabajo.')

    setSaving(true)
    try {
      await sanidadService.actualizarTrabajo(trabajo.id, {
        nombre:           nombreFinal,
        fecha_programada: fecha,
        tratamiento:      tratamiento.trim()   || null,
        observaciones:    observaciones.trim() || null,
      })
      await sanidadService.sincronizarCaballos(trabajo.id, [...seleccionados])
      onSuccess()
    } catch (err) {
      setError(mensajeError(err, 'No se pudo guardar.'))
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}
    >
      <div className="w-full max-w-xl sm:mx-4 rounded-t-2xl sm:rounded-xl border border-slate-300 bg-white shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <Pencil size={15} className="text-brand-600" />
            <h2 className="text-sm font-semibold text-slate-900">Editar trabajo programado</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
        </div>

        {cargando ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (
          <form id="editar-trabajo-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={catId}
                onChange={(e) => setCatId(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">— Tipo de trabajo —</option>
                {catalogo.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                <option value={OTRO}>Otro…</option>
              </select>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {catId === OTRO && (
              <input
                type="text"
                value={nombreLibre}
                onChange={(e) => setNombreLibre(e.target.value)}
                placeholder="Nombre del trabajo"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            )}

            <input
              type="text"
              value={tratamiento}
              onChange={(e) => setTratamiento(e.target.value)}
              placeholder="Tratamiento / producto (opcional)"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Observaciones</label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
              />
            </div>

            {/* Caballos del trabajo */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500">
                Caballos ({seleccionados.size} seleccionado{seleccionados.size !== 1 ? 's' : ''})
              </label>

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

              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {fueraDeLista.map((c) => (
                  <label key={c.id} className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={seleccionados.has(c.id)}
                      onChange={() => toggle(c.id)}
                      className="rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                    />
                    <span className="text-slate-700">{c.nombre}</span>
                    <span className="ml-auto text-[11px] text-slate-400">fuera del listado</span>
                  </label>
                ))}
                {filtrados.length === 0 && fueraDeLista.length === 0 ? (
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
                    <span className="ml-auto text-[11px] text-slate-400 shrink-0">{c.categoria}</span>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-xs text-red-600">
                <AlertCircle size={13} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}
          </form>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-5 py-3 shrink-0">
          {onEliminar ? (
            <button
              type="button"
              onClick={onEliminar}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 size={14} /> Eliminar
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="editar-trabajo-form"
              disabled={saving || cargando}
              className="px-4 py-2 text-sm font-medium rounded-md bg-brand-500 hover:bg-brand-400 text-white transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
