import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { caballoService, type NuevoCaballoPayload } from '../../services/caballoService'
import { catalogoService } from '../../services/catalogoService'
import { getMarcas, type MarcaAdmin } from '../../services/adminService'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

const CATEGORIAS = ['Caballo', 'Yegua', 'Padrillo', 'Potrillo'] as const

export default function NuevoCaballoModal({ onClose, onSuccess }: Props) {
  const { sociedadActiva, marcaId: miMarcaId } = useAuth()
  const esAdminHaras = miMarcaId === null

  const [razas,   setRazas]   = useState<{ id: number; nombre: string }[]>([])
  const [pelajes, setPelajes] = useState<{ id: number; nombre: string }[]>([])
  const [marcas,  setMarcas]  = useState<MarcaAdmin[]>([])

  const [form, setForm] = useState({
    nombre: '',
    fecha_nacimiento: '',
    categoria: 'Caballo' as NuevoCaballoPayload['categoria'],
    raza_id: 0,
    pelaje_id: 0,
    numero_chip: '',
    numero_registro: '',
    marca_id: miMarcaId ?? '',
  })

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  useEffect(() => {
    Promise.all([
      catalogoService.razas(),
      catalogoService.pelajes(),
      sociedadActiva ? getMarcas(sociedadActiva.id) : Promise.resolve([]),
    ]).then(([r, p, m]) => {
      setRazas(r)
      setPelajes(p)
      setMarcas(m)
      setForm((f) => ({
        ...f,
        raza_id:   r[0]?.id ?? 0,
        pelaje_id: p[0]?.id ?? 0,
        marca_id:  miMarcaId ?? m[0]?.id ?? '',
      }))
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function set(field: keyof typeof form, value: string | number) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim())       return setError('El nombre es requerido.')
    if (!form.fecha_nacimiento)    return setError('La fecha de nacimiento es requerida.')
    if (!form.raza_id)             return setError('Seleccioná una raza.')
    if (!form.pelaje_id)           return setError('Seleccioná un pelaje.')
    if (!form.marca_id)            return setError('Seleccioná una marca.')
    if (!sociedadActiva)           return

    setSaving(true)
    setError('')
    try {
      await caballoService.crear(
        {
          nombre:           form.nombre.trim(),
          fecha_nacimiento: form.fecha_nacimiento,
          categoria:        form.categoria,
          raza_id:          Number(form.raza_id),
          pelaje_id:        Number(form.pelaje_id),
          numero_chip:      form.numero_chip.trim() || undefined,
          numero_registro:  form.numero_registro.trim() || undefined,
          marca_id:         form.marca_id,
        },
        sociedadActiva.id
      )
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar.')
    } finally {
      setSaving(false)
    }
  }

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-100">Nuevo caballo</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X size={16} /></button>
        </div>

        {/* Form */}
        <form
          id="nuevo-caballo-form"
          onSubmit={handleSubmit}
          className="overflow-y-auto flex-1 p-5 space-y-4"
        >
          {/* Nombre */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Nombre *</label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => set('nombre', e.target.value)}
              placeholder="Compadre"
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Fecha + Categoría */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Fecha nacimiento *</label>
              <input
                type="date"
                value={form.fecha_nacimiento}
                onChange={(e) => set('fecha_nacimiento', e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Categoría *</label>
              <select
                value={form.categoria}
                onChange={(e) => set('categoria', e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Raza + Pelaje */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Raza *</label>
              <select
                value={form.raza_id}
                onChange={(e) => set('raza_id', Number(e.target.value))}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {razas.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Pelaje *</label>
              <select
                value={form.pelaje_id}
                onChange={(e) => set('pelaje_id', Number(e.target.value))}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {pelajes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          </div>

          {/* Marca — solo admin haras elige, admin marca la tiene fija */}
          {esAdminHaras ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Marca propietaria *</label>
              <select
                value={form.marca_id}
                onChange={(e) => set('marca_id', e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">— Seleccioná una marca —</option>
                {marcas.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Marca propietaria</label>
              <p className="text-sm text-zinc-300 px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700">
                {marcas.find((m) => m.id === form.marca_id)?.nombre ?? '—'}
              </p>
            </div>
          )}

          {/* Chip + Registro */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">N° chip</label>
              <input
                type="text"
                value={form.numero_chip}
                onChange={(e) => set('numero_chip', e.target.value)}
                placeholder="941000024850001"
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">N° registro</label>
              <input
                type="text"
                value={form.numero_registro}
                onChange={(e) => set('numero_registro', e.target.value)}
                placeholder="SA-0009"
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-zinc-800 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="nuevo-caballo-form"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Crear caballo'}
          </button>
        </div>
      </div>
    </div>
  )
}
