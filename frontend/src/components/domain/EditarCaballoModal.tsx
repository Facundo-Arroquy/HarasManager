import { useEffect, useState } from 'react'
import { X, Plus, AlertTriangle, GitBranch } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { caballoService, type NuevoCaballoPayload, type Caballo } from '../../services/caballoService'
import { catalogoService } from '../../services/catalogoService'
import { campoService, type Campo } from '../../services/campoService'
import PedigreeCombobox from './PedigreeCombobox'

interface CaballoEditProps {
  id: string
  nombre: string
  fecha_nacimiento?: string | null
  categoria?: string | null
  subcategoria?: string | null
  raza_id?: number | null
  pelaje_id?: number | null
  numero_chip?: string | null
  numero_registro?: string | null
  campo_id?: string | null
  padre_id?: string | null
  padre_nombre?: string | null
  madre_id?: string | null
  madre_nombre?: string | null
}

interface Props {
  caballo: CaballoEditProps
  onClose: () => void
  onSuccess: () => void
  caballos?: Caballo[]
}

const CATEGORIAS = ['Caballo', 'Yegua', 'Padrillo', 'Potrillo'] as const

export default function EditarCaballoModal({ caballo, onClose, onSuccess, caballos = [] }: Props) {
  const { sociedadActiva, rol } = useAuth()
  const esAdmin = rol === 'admin'

  const [razas,   setRazas]   = useState<{ id: number; nombre: string }[]>([])
  const [pelajes, setPelajes] = useState<{ id: number; nombre: string }[]>([])
  const [campos,  setCampos]  = useState<Campo[]>([])
  const [nuevoCampo,    setNuevoCampo]    = useState('')
  const [creandoCampo,  setCreandoCampo]  = useState(false)
  const [confirmBaja,   setConfirmBaja]   = useState(false)

  const [form, setForm] = useState({
    nombre:           caballo.nombre,
    fecha_nacimiento: caballo.fecha_nacimiento ?? '',
    categoria:        (caballo.categoria ?? 'Caballo') as NuevoCaballoPayload['categoria'],
    subcategoria:     (caballo.subcategoria ?? '') as string,
    raza_id:          caballo.raza_id ?? 0,
    pelaje_id:        caballo.pelaje_id ?? 0,
    numero_chip:      caballo.numero_chip ?? '',
    numero_registro:  caballo.numero_registro ?? '',
    campo_id:         caballo.campo_id ?? '',
  })

  const [genealogia, setGenealogia] = useState({
    padre_id:     caballo.padre_id    ?? null as string | null,
    padre_nombre: caballo.padre_nombre ?? null as string | null,
    madre_id:     caballo.madre_id    ?? null as string | null,
    madre_nombre: caballo.madre_nombre ?? null as string | null,
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
        raza_id:   f.raza_id   || r[0]?.id || 0,
        pelaje_id: f.pelaje_id || p[0]?.id || 0,
      }))
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function set(field: keyof typeof form, value: string | number) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim())    return setError('El nombre es requerido.')
    if (!form.fecha_nacimiento) return setError('La fecha de nacimiento es requerida.')
    setSaving(true)
    setError('')
    try {
      await caballoService.actualizar(caballo.id, {
        nombre:           form.nombre.trim(),
        fecha_nacimiento: form.fecha_nacimiento,
        categoria:        form.categoria,
        subcategoria:     form.categoria === 'Yegua' && form.subcategoria
                            ? form.subcategoria as 'Donante' | 'Receptora'
                            : null,
        raza_id:          Number(form.raza_id),
        pelaje_id:        Number(form.pelaje_id),
        numero_chip:      form.numero_chip.trim()      || undefined,
        numero_registro:  form.numero_registro.trim()  || undefined,
        campo_id:         form.campo_id                || null,
        padre_id:         genealogia.padre_id,
        padre_nombre:     genealogia.padre_nombre,
        madre_id:         genealogia.madre_id,
        madre_nombre:     genealogia.madre_nombre,
      })
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleBaja() {
    setSaving(true)
    try {
      await caballoService.darDeBaja(caballo.id)
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al dar de baja.')
    } finally {
      setSaving(false)
    }
  }

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
      <div className="w-full max-w-lg mx-4 sm:mx-0 rounded-xl border border-slate-300 bg-white shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Editar caballo</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
        </div>

        {/* Form */}
        <form
          id="editar-caballo-form"
          onSubmit={handleSubmit}
          className="overflow-y-auto flex-1 p-5 space-y-4"
        >
          {/* Nombre */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Nombre *</label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => set('nombre', e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Fecha + Categoría */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Fecha nacimiento *</label>
              <input
                type="date"
                value={form.fecha_nacimiento}
                onChange={(e) => set('fecha_nacimiento', e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Categoría</label>
              <select
                value={form.categoria}
                onChange={(e) => set('categoria', e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Subcategoría (solo Yegua) */}
          {form.categoria === 'Yegua' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Rol reproductivo</label>
              <select
                value={form.subcategoria}
                onChange={(e) => set('subcategoria', e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">— Sin especificar —</option>
                <option value="Donante">Donante</option>
                <option value="Receptora">Receptora</option>
              </select>
            </div>
          )}

          {/* Raza + Pelaje */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Raza</label>
              <select
                value={form.raza_id}
                onChange={(e) => set('raza_id', Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {razas.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Pelaje</label>
              <select
                value={form.pelaje_id}
                onChange={(e) => set('pelaje_id', Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {pelajes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          </div>

          {/* Campo / Caballeriza */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Campo / Caballeriza</label>
            <div className="flex gap-2">
              <select
                value={form.campo_id}
                onChange={(e) => set('campo_id', e.target.value)}
                className="flex-1 rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">— Sin asignar —</option>
                {campos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <button
                type="button"
                onClick={() => setCreandoCampo((v) => !v)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-slate-300 text-xs text-slate-500 hover:text-slate-700 hover:border-slate-400 transition-colors"
                title="Crear nuevo campo"
              >
                <Plus size={13} /> Nuevo
              </button>
            </div>
            {creandoCampo && (
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  value={nuevoCampo}
                  onChange={(e) => setNuevoCampo(e.target.value)}
                  placeholder="Nombre del campo"
                  autoFocus
                  className="flex-1 rounded-md border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
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
                  className="px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-500 text-xs font-medium text-white disabled:opacity-40 transition-colors"
                >
                  Crear
                </button>
              </div>
            )}
          </div>

          {/* Chip + Registro */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">N° chip</label>
              <input
                type="text"
                value={form.numero_chip}
                onChange={(e) => set('numero_chip', e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">N° registro</label>
              <input
                type="text"
                value={form.numero_registro}
                onChange={(e) => set('numero_registro', e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Genealogía */}
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-3">
              <GitBranch size={13} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Genealogía</span>
            </div>
            <div className="space-y-3">
              <PedigreeCombobox
                label="Padre"
                placeholder="— Sin datos —"
                value={{ id: genealogia.padre_id, nombre: genealogia.padre_nombre }}
                onChange={(v) => setGenealogia((g) => ({ ...g, padre_id: v.id ?? null, padre_nombre: v.nombre ?? null }))}
                caballos={caballos.filter((c) => c.id !== caballo.id)}
              />
              <PedigreeCombobox
                label="Madre"
                placeholder="— Sin datos —"
                value={{ id: genealogia.madre_id, nombre: genealogia.madre_nombre }}
                onChange={(v) => setGenealogia((g) => ({ ...g, madre_id: v.id ?? null, madre_nombre: v.nombre ?? null }))}
                caballos={caballos.filter((c) => c.id !== caballo.id)}
              />
            </div>
          </div>

          {/* Confirmación de baja */}
          {confirmBaja && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-rose-600 shrink-0" />
                <p className="text-xs font-medium text-rose-700">
                  ¿Dar de baja a <span className="font-semibold">{caballo.nombre}</span>?
                </p>
              </div>
              <p className="text-xs text-rose-600/80">
                El animal ya no aparecerá en el listado activo. Se puede reactivar luego.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmBaja(false)}
                  className="px-3 py-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleBaja}
                  disabled={saving}
                  className="px-3 py-1 text-xs font-medium rounded-md bg-rose-700 hover:bg-rose-600 text-white disabled:opacity-40 transition-colors"
                >
                  {saving ? 'Procesando…' : 'Dar de baja'}
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-rose-600">{error}</p>}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-5 py-3">
          <div>
            {esAdmin && !confirmBaja && (
              <button
                type="button"
                onClick={() => setConfirmBaja(true)}
                className="px-3 py-1.5 text-xs text-rose-500 hover:text-rose-700 transition-colors"
              >
                Dar de baja
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="editar-caballo-form"
              disabled={saving || confirmBaja}
              className="px-4 py-2 text-sm font-medium rounded-md bg-amber-500 hover:bg-amber-400 text-white transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
