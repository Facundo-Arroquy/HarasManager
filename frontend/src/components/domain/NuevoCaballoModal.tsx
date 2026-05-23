import { useEffect, useState } from 'react'
import { X, Plus } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { caballoService, type NuevoCaballoPayload } from '../../services/caballoService'
import { catalogoService } from '../../services/catalogoService'
import { campoService, type Campo } from '../../services/campoService'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

const CATEGORIAS = ['Caballo', 'Yegua', 'Padrillo', 'Potrillo'] as const

export default function NuevoCaballoModal({ onClose, onSuccess }: Props) {
  const { sociedadActiva } = useAuth()

  const [razas,   setRazas]   = useState<{ id: number; nombre: string }[]>([])
  const [pelajes, setPelajes] = useState<{ id: number; nombre: string }[]>([])
  const [campos,  setCampos]  = useState<Campo[]>([])
  const [nuevoCampo, setNuevoCampo] = useState('')
  const [creandoCampo, setCreandoCampo] = useState(false)

  const [form, setForm] = useState({
    nombre: '',
    fecha_nacimiento: '',
    categoria: 'Caballo' as NuevoCaballoPayload['categoria'],
    raza_id: 0,
    pelaje_id: 0,
    numero_chip: '',
    numero_registro: '',
    campo_id: '' as string,
  })

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  useEffect(() => {
    Promise.all([
      catalogoService.razas(),
      catalogoService.pelajes(),
      sociedadActiva ? campoService.listar(sociedadActiva.id) : Promise.resolve([]),
    ]).then(([r, p, c]) => {
      setRazas(r)
      setPelajes(p)
      setCampos(c)
      setForm((f) => ({
        ...f,
        raza_id:   r[0]?.id ?? 0,
        pelaje_id: p[0]?.id ?? 0,
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
          campo_id:         form.campo_id || null,
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
      <div className="w-full max-w-lg mx-4 sm:mx-0 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl max-h-[90vh] flex flex-col">
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

          {/* Campo / Caballeriza */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Campo / Caballeriza</label>
            <div className="flex gap-2">
              <select
                value={form.campo_id}
                onChange={(e) => set('campo_id', e.target.value)}
                className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">— Sin asignar —</option>
                {campos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <button
                type="button"
                onClick={() => setCreandoCampo((v) => !v)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                title="Crear nuevo campo"
              >
                <Plus size={13} />
                Nuevo
              </button>
            </div>
            {creandoCampo && (
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  value={nuevoCampo}
                  onChange={(e) => setNuevoCampo(e.target.value)}
                  placeholder="Nombre del campo"
                  className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  disabled={!nuevoCampo.trim()}
                  onClick={async () => {
                    if (!nuevoCampo.trim() || !sociedadActiva) return
                    const c = await campoService.crear(nuevoCampo.trim(), undefined, sociedadActiva.id)
                    setCampos((prev) => [...prev, c])
                    set('campo_id', c.id)
                    setNuevoCampo('')
                    setCreandoCampo(false)
                  }}
                  className="px-3 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-600 text-xs font-medium text-white disabled:opacity-40 transition-colors"
                >
                  Crear
                </button>
              </div>
            )}
          </div>

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
