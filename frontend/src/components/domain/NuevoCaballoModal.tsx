import { useEffect, useState } from 'react'
import { X, Plus } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useAuthStore } from '../../store/authStore'
import { caballoService, type NuevoCaballoPayload } from '../../services/caballoService'
import { catalogoService } from '../../services/catalogoService'
import { campoService, type Campo } from '../../services/campoService'

interface Props {
  onClose: () => void
  onSuccess: () => void
  vetMode?: boolean
}

const CATEGORIAS = ['Caballo', 'Yegua', 'Padrillo', 'Potrillo'] as const

type ModoProgenitor = 'ninguno' | 'existente' | 'texto'

interface CaballoSimple { id: string; nombre: string; categoria: string }

export default function NuevoCaballoModal({ onClose, onSuccess, vetMode = false }: Props) {
  const { sociedadActiva } = useAuth()
  const userId = useAuthStore((s) => s.user?.id)

  const [razas,   setRazas]   = useState<{ id: number; nombre: string }[]>([])
  const [pelajes, setPelajes] = useState<{ id: number; nombre: string }[]>([])
  const [campos,  setCampos]  = useState<Campo[]>([])
  const [caballos, setCaballos] = useState<CaballoSimple[]>([])
  const [nuevoCampo, setNuevoCampo] = useState('')
  const [creandoCampo, setCreandoCampo] = useState(false)

  const [form, setForm] = useState({
    nombre: '',
    fecha_nacimiento: '',
    categoria: 'Caballo' as NuevoCaballoPayload['categoria'],
    subcategoria: '' as string,
    raza_id: 0,
    pelaje_id: 0,
    numero_chip: '',
    numero_registro: '',
    campo_id: '' as string,
  })

  // Estado padre
  const [padreMode,  setPadreMode]  = useState<ModoProgenitor>('ninguno')
  const [padreId,    setPadreId]    = useState('')
  const [padreTexto, setPadreTexto] = useState('')

  // Estado madre
  const [madreMode,  setMadreMode]  = useState<ModoProgenitor>('ninguno')
  const [madreId,    setMadreId]    = useState('')
  const [madreTexto, setMadreTexto] = useState('')

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
      setCaballos((cabs as any[]).map((c: any) => ({ id: c.id, nombre: c.nombre, categoria: c.categoria ?? '' })))
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
    if (!vetMode && !sociedadActiva) return
    if (vetMode && !userId)        return

    setSaving(true)
    setError('')

    const payload: NuevoCaballoPayload = {
      nombre:           form.nombre.trim(),
      fecha_nacimiento: form.fecha_nacimiento,
      categoria:        form.categoria,
      subcategoria:     form.categoria === 'Yegua' && form.subcategoria
                          ? form.subcategoria as 'Donante' | 'Receptora'
                          : null,
      raza_id:          Number(form.raza_id),
      pelaje_id:        Number(form.pelaje_id),
      numero_chip:      form.numero_chip.trim() || undefined,
      numero_registro:  form.numero_registro.trim() || undefined,
      campo_id:         vetMode ? null : (form.campo_id || null),
      padre_id:         padreMode === 'existente' && padreId ? padreId : null,
      padre_nombre:     padreMode === 'texto' && padreTexto.trim() ? padreTexto.trim() : null,
      madre_id:         madreMode === 'existente' && madreId ? madreId : null,
      madre_nombre:     madreMode === 'texto' && madreTexto.trim() ? madreTexto.trim() : null,
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
              <label className="text-xs font-medium text-slate-500">Categoría *</label>
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

          {/* ── Árbol genealógico ─────────────────────────────────────────── */}
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Árbol genealógico</p>

            {/* Padre */}
            <ProgenitorField
              label="Padre"
              mode={padreMode}
              id={padreId}
              texto={padreTexto}
              caballos={caballos}
              onModeChange={(m) => { setPadreMode(m); setPadreId(''); setPadreTexto('') }}
              onIdChange={setPadreId}
              onTextoChange={setPadreTexto}
            />

            {/* Madre */}
            <ProgenitorField
              label="Madre"
              mode={madreMode}
              id={madreId}
              texto={madreTexto}
              caballos={caballos}
              onModeChange={(m) => { setMadreMode(m); setMadreId(''); setMadreTexto('') }}
              onIdChange={setMadreId}
              onTextoChange={setMadreTexto}
            />
          </div>

          {/* Raza + Pelaje */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Raza *</label>
              <select
                value={form.raza_id}
                onChange={(e) => set('raza_id', Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {razas.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Pelaje *</label>
              <select
                value={form.pelaje_id}
                onChange={(e) => set('pelaje_id', Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {pelajes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          </div>

          {/* Campo / Caballeriza — solo en modo org */}
          {!vetMode && <div className="space-y-1.5">
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
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 placeholder-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">N° registro</label>
              <input
                type="text"
                value={form.numero_registro}
                onChange={(e) => set('numero_registro', e.target.value)}
                placeholder="SA-0009"
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 placeholder-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
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
            className="px-4 py-2 text-sm font-medium rounded-md bg-amber-500 hover:bg-amber-400 text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Crear caballo'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Campo de progenitor (padre o madre) ────────────────────────────────────────

interface ProgenitorFieldProps {
  label: string
  mode: ModoProgenitor
  id: string
  texto: string
  caballos: CaballoSimple[]
  onModeChange: (m: ModoProgenitor) => void
  onIdChange: (id: string) => void
  onTextoChange: (t: string) => void
}

function ProgenitorField({ label, mode, id, texto, caballos, onModeChange, onIdChange, onTextoChange }: ProgenitorFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500 w-10">{label}</span>
        <div className="flex gap-1">
          {(['existente', 'texto'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(mode === m ? 'ninguno' : m)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                mode === m
                  ? 'bg-amber-500 text-white'
                  : 'bg-white border border-slate-300 text-slate-500 hover:border-slate-400'
              }`}
            >
              {m === 'existente' ? 'Seleccionar' : 'Texto libre'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'existente' && (
        <select
          value={id}
          onChange={(e) => onIdChange(e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
        >
          <option value="">— Sin especificar —</option>
          {caballos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} {c.categoria ? `(${c.categoria})` : ''}
            </option>
          ))}
        </select>
      )}

      {mode === 'texto' && (
        <input
          type="text"
          value={texto}
          onChange={(e) => onTextoChange(e.target.value)}
          placeholder={label === 'Padre' ? 'Nombre del padrillo…' : 'Nombre de la madre…'}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
      )}
    </div>
  )
}
