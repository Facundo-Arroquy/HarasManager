import { useEffect, useState } from 'react'
import { X, GitBranch } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useAuthStore } from '../../store/authStore'
import { caballoService, type NuevoCaballoPayload, type Caballo } from '../../services/caballoService'
import { catalogoService } from '../../services/catalogoService'
import { campoService, type Campo } from '../../services/campoService'
import PedigreeCombobox, { type HorseRef } from './PedigreeCombobox'

interface Props {
  onClose: () => void
  onSuccess: () => void
  vetMode?: boolean
}

const CATEGORIAS = ['Caballo', 'Yegua', 'Padrillo', 'Potrillo'] as const

export default function NuevoCaballoModal({ onClose, onSuccess, vetMode = false }: Props) {
  const { sociedadActiva } = useAuth()
  const userId = useAuthStore((s) => s.user?.id)

  const [razas,   setRazas]   = useState<{ id: number; nombre: string }[]>([])
  const [pelajes, setPelajes] = useState<{ id: number; nombre: string }[]>([])
  const [campos,  setCampos]  = useState<Campo[]>([])
  const [caballos, setCaballos] = useState<Caballo[]>([])
  const [form, setForm] = useState({
    nombre: '',
    fecha_nacimiento: '',
    categoria: 'Caballo' as NuevoCaballoPayload['categoria'],
    subcategoria: '' as string,
    raza_id: 0,    // 0 = sin selección
    pelaje_id: 0,  // 0 = sin selección
    numero_chip: '',
    numero_registro: '',
    campo_id: '' as string,
  })

  const [padre, setPadre] = useState<HorseRef>({ id: null, nombre: null })
  const [madre, setMadre] = useState<HorseRef>({ id: null, nombre: null })

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  useEffect(() => {
    const caballosPromise = vetMode && userId
      ? caballoService.listarDelVeterinario(userId)
      : sociedadActiva
        ? caballoService.listar(sociedadActiva.id)
        : Promise.resolve([])

    Promise.all([
      catalogoService.razas(),
      catalogoService.pelajes(),
      (!vetMode && sociedadActiva) ? campoService.listar(sociedadActiva.id) : Promise.resolve([]),
      caballosPromise,
    ]).then(([r, p, c, cabs]) => {
      setRazas(r)
      setPelajes(p)
      setCampos(c)
      setCaballos(cabs as Caballo[])
      // No pre-seleccionamos raza/pelaje — el admin elige o deja vacío
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function set(field: keyof typeof form, value: string | number) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim())         return setError('El nombre es requerido.')
    if (!vetMode && !sociedadActiva) return
    if (vetMode && !userId)          return

    setSaving(true)
    setError('')

    const payload: NuevoCaballoPayload = {
      nombre:           form.nombre.trim(),
      categoria:        form.categoria,
      rol_reproductivo: form.categoria === 'Yegua' && form.subcategoria
                          ? form.subcategoria as 'Donante' | 'Receptora'
                          : null,
      raza_id:          form.raza_id   || null,
      pelaje_id:        form.pelaje_id || null,
      fecha_nacimiento: form.fecha_nacimiento || null,
      numero_chip:      form.numero_chip.trim() || undefined,
      numero_registro:  form.numero_registro.trim() || undefined,
      campo_id:         vetMode ? null : (form.campo_id || null),
      padre_id:         padre.id    ?? null,
      padre_nombre:     padre.nombre ?? null,
      madre_id:         madre.id    ?? null,
      madre_nombre:     madre.nombre ?? null,
    }

    try {
      if (vetMode) {
        await caballoService.crearParaVet(payload, userId!)
      } else {
        await caballoService.crear(payload, sociedadActiva!.id)
      }
      onSuccess()
    } catch (err: unknown) {
      const msg = (err as any)?.message ?? (err instanceof Error ? err.message : String(err))
      setError(msg)
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
      <div className="w-full max-w-lg mx-4 sm:mx-0 rounded-xl border border-slate-300 bg-white shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Nuevo caballo</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
        </div>

        {/* Form */}
        <form
          id="nuevo-caballo-form"
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
              placeholder="Compadre"
              className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Fecha + Categoría */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Fecha nacimiento</label>
              <input
                type="date"
                value={form.fecha_nacimiento}
                onChange={(e) => set('fecha_nacimiento', e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Categoría</label>
              <select
                value={form.categoria}
                onChange={(e) => set('categoria', e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">— Sin especificar —</option>
                <option value="Donante">Donante</option>
                <option value="Receptora">Receptora</option>
              </select>
            </div>
          )}

          {/* ── Genealogía ─────────────────────────────────────────────── */}
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-3">
              <GitBranch size={13} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Genealogía</span>
            </div>
            <div className="space-y-3">
              <PedigreeCombobox
                label="Padre"
                placeholder="— Sin datos —"
                value={padre}
                onChange={setPadre}
                caballos={caballos}
              />
              <PedigreeCombobox
                label="Madre"
                placeholder="— Sin datos —"
                value={madre}
                onChange={setMadre}
                caballos={caballos}
              />
            </div>
          </div>

          {/* Raza + Pelaje */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Raza</label>
              <select
                value={form.raza_id}
                onChange={(e) => set('raza_id', Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value={0}>— Sin especificar —</option>
                {razas.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Pelaje</label>
              <select
                value={form.pelaje_id}
                onChange={(e) => set('pelaje_id', Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value={0}>— Sin especificar —</option>
                {pelajes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          </div>

          {/* Campo / Caballeriza — solo en modo org */}
          {!vetMode && <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500">Campo / Caballeriza</label>
            <select
              value={form.campo_id}
              onChange={(e) => set('campo_id', e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">— Sin asignar —</option>
              {campos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>}

          {/* Chip + Registro */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">N° chip</label>
              <input
                type="text"
                value={form.numero_chip}
                onChange={(e) => set('numero_chip', e.target.value)}
                placeholder="941000024850001"
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 placeholder-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">N° registro</label>
              <input
                type="text"
                value={form.numero_registro}
                onChange={(e) => set('numero_registro', e.target.value)}
                placeholder="SA-0009"
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 placeholder-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          {error && <p className="text-xs text-rose-600">{error}</p>}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="nuevo-caballo-form"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-md bg-brand-500 hover:bg-brand-400 text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Crear caballo'}
          </button>
        </div>
      </div>
    </div>
  )
}

