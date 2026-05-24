import { useEffect, useState } from 'react'
import { Plus, Trash2, Printer, RotateCcw } from 'lucide-react'
import { caballoService } from '../../services/caballoService'
import { useAuthStore } from '../../store/authStore'
import { isMockMode, getMockUserId } from '../../dev/mockMode'
import { getMockUser } from '../../dev/mockUsers'
import { hoyAR } from '../../utils/fecha'
import { imprimirRevision } from '../../utils/imprimirRevision'
import Spinner from '../../components/ui/Spinner'

type Caballo = Awaited<ReturnType<typeof caballoService.listar>>[number]

type Resultado = 'normal' | 'anormal' | 'a_observar'

interface ItemRevision {
  tempId: string
  categoria: string
  hallazgo: string
  resultado: Resultado
}

const RESULTADO_OPTS: { value: Resultado; label: string }[] = [
  { value: 'normal',     label: 'Normal' },
  { value: 'a_observar', label: 'A observar' },
  { value: 'anormal',    label: 'Anormal' },
]

const RES_CLASS: Record<Resultado, string> = {
  normal:     'text-amber-600',
  a_observar: 'text-amber-600',
  anormal:    'text-rose-600',
}

const CATEGORIAS_DEFAULT = [
  'Estado general y corporal',
  'Sistema locomotor',
  'Aparato cardiovascular',
  'Sistema respiratorio',
  'Aparato digestivo',
  'Sistema nervioso',
  'Ojos y visión',
  'Piel, tegumentos y mucosas',
]

let _uid = 0
const uid = () => String(++_uid)

function makeDefaultItems(): ItemRevision[] {
  return CATEGORIAS_DEFAULT.map((cat) => ({
    tempId: uid(),
    categoria: cat,
    hallazgo: '',
    resultado: 'normal',
  }))
}

function getVetNombre(user: { email?: string | null } | null): string {
  if (isMockMode()) {
    const mu = getMockUser(getMockUserId())
    return `${mu.nombre} ${mu.apellido}`.trim()
  }
  return (user as any)?.user_metadata?.full_name
    ?? (user as any)?.user_metadata?.nombre
    ?? user?.email
    ?? ''
}

export default function RevisionPreVentaPage() {
  const user     = useAuthStore((s) => s.user)
  const sociedad = useAuthStore((s) => s.sociedadActiva)

  const [caballos,   setCaballos]   = useState<Caballo[]>([])
  const [loading,    setLoading]    = useState(true)

  // Campos del formulario
  const [caballoId,  setCaballoId]  = useState('')
  const [fecha,      setFecha]      = useState(hoyAR())
  const [comprador,  setComprador]  = useState('')
  const [firmante,   setFirmante]   = useState(() => getVetNombre(user))
  const [items,      setItems]      = useState<ItemRevision[]>(makeDefaultItems)
  const [conclusion, setConclusion] = useState('')
  const [dictamen,   setDictamen]   = useState<'apto' | 'no_apto' | 'condicionado'>('apto')

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }
    const fn = sociedad?.id
      ? () => caballoService.listar(sociedad.id)
      : () => caballoService.listarDelVeterinario(user.id)
    fn().then(setCaballos).finally(() => setLoading(false))
  }, [sociedad?.id, user?.id])

  const addItem = () =>
    setItems((p) => [...p, { tempId: uid(), categoria: '', hallazgo: '', resultado: 'normal' }])

  const remItem = (id: string) =>
    setItems((p) => p.filter((i) => i.tempId !== id))

  const updItem = (id: string, key: keyof ItemRevision, val: string) =>
    setItems((p) => p.map((i) => i.tempId === id ? { ...i, [key]: val } : i))

  const handleReset = () => {
    setCaballoId('')
    setFecha(hoyAR())
    setComprador('')
    setConclusion('')
    setDictamen('apto')
    setItems(makeDefaultItems())
  }

  const handleExportar = () => {
    const caballo = caballos.find((c) => c.id === caballoId)
    if (!caballo) return
    imprimirRevision({
      caballo: caballo as any,
      fecha,
      firmante: firmante || getVetNombre(user),
      email: user?.email ?? '',
      comprador: comprador || undefined,
      items: items.filter((i) => i.categoria.trim()),
      conclusion,
      dictamen,
    })
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  const caballo = caballos.find((c) => c.id === caballoId)

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Revisión pre-venta</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Certificado de revisión clínica para compraventa de equino
        </p>
      </div>

      {/* ── Datos generales ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 mb-4">
        <h2 className={sectionTitle}>Datos generales</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={fieldWrapper}>
            <label className={labelClass}>Caballo *</label>
            <select value={caballoId} onChange={(e) => setCaballoId(e.target.value)} className={selectClass}>
              <option value="">— Seleccionar —</option>
              {caballos.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div className={fieldWrapper}>
            <label className={labelClass}>Fecha de revisión *</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className={fieldWrapper}>
            <label className={labelClass}>Comprador / Adquirente</label>
            <input
              type="text"
              value={comprador}
              onChange={(e) => setComprador(e.target.value)}
              placeholder="Nombre del comprador"
              className={inputClass}
            />
          </div>
        </div>

        {/* Info del caballo */}
        {caballo && (
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-slate-100/60 px-3 py-2 text-xs text-slate-500 flex-wrap">
            <span className="font-medium text-slate-600">{caballo.nombre}</span>
            {caballo.categoria && <span>· {caballo.categoria}</span>}
            {(caballo as any).cat_raza && <span>· {(caballo as any).cat_raza.nombre}</span>}
            {(caballo as any).cat_pelaje && <span>· {(caballo as any).cat_pelaje.nombre}</span>}
            {(caballo as any).numero_chip && (
              <span className="font-mono text-slate-400">
                Chip: {(caballo as any).numero_chip}
              </span>
            )}
          </div>
        )}

        {/* Firmante */}
        <div className={`${fieldWrapper} mt-4 max-w-xs`}>
          <label className={labelClass}>Nombre en el certificado *</label>
          <input
            type="text"
            value={firmante}
            onChange={(e) => setFirmante(e.target.value)}
            placeholder="Dr/a. Nombre Apellido"
            className={inputClass}
          />
        </div>
      </div>

      {/* ── Hallazgos clínicos ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className={sectionTitle} style={{ margin: 0 }}>Hallazgos clínicos</h2>
          <button onClick={addItem} className="flex items-center gap-1 text-xs text-slate-400 hover:text-amber-600 transition-colors">
            <Plus size={13} /> Agregar ítem
          </button>
        </div>

        {/* Cabecera de columnas */}
        <div className="hidden sm:grid grid-cols-[2fr_3fr_1fr_auto] gap-2 mb-2 px-1">
          <p className={colHeader}>Sistema / Área</p>
          <p className={colHeader}>Hallazgo / Observación</p>
          <p className={colHeader}>Resultado</p>
          <span />
        </div>

        {items.length === 0 && (
          <p className="text-xs text-slate-400 italic text-center py-6">
            Sin ítems. Usá "Agregar ítem" para añadir hallazgos.
          </p>
        )}

        <div className="space-y-2">
          {items.map((item) => (
            /* Mobile: card apilada · Desktop: grid de 4 columnas */
            <div
              key={item.tempId}
              className="rounded-lg border border-slate-200 p-3 space-y-2 sm:border-0 sm:p-0 sm:space-y-0 sm:grid sm:grid-cols-[2fr_3fr_1fr_auto] sm:gap-2 sm:items-start"
            >
              <input
                type="text"
                value={item.categoria}
                onChange={(e) => updItem(item.tempId, 'categoria', e.target.value)}
                placeholder="Sistema / Área"
                className={inputClass}
              />
              <input
                type="text"
                value={item.hallazgo}
                onChange={(e) => updItem(item.tempId, 'hallazgo', e.target.value)}
                placeholder="Sin alteraciones…"
                className={inputClass}
              />
              {/* En mobile: select + botón en la misma fila */}
              <div className="flex items-center gap-2 sm:contents">
                <select
                  value={item.resultado}
                  onChange={(e) => updItem(item.tempId, 'resultado', e.target.value)}
                  className={`${selectClass} ${RES_CLASS[item.resultado]} flex-1 sm:flex-none`}
                >
                  {RESULTADO_OPTS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => remItem(item.tempId)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors rounded shrink-0 sm:mt-0.5"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Conclusión y dictamen ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 mb-6">
        <h2 className={sectionTitle}>Conclusión y dictamen</h2>

        <div className={fieldWrapper}>
          <label className={labelClass}>Observaciones generales</label>
          <textarea
            value={conclusion}
            onChange={(e) => setConclusion(e.target.value)}
            rows={3}
            placeholder="Conclusión clínica general del examen…"
            className={textareaClass}
          />
        </div>

        <div className={`${fieldWrapper} mt-4`}>
          <label className={labelClass}>Dictamen</label>
          <div className="flex gap-2 flex-wrap">
            {DICTAMEN_OPTS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDictamen(opt.value as typeof dictamen)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  dictamen === opt.value ? opt.active : opt.inactive
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-between items-center gap-3">
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          <RotateCcw size={14} /> Limpiar formulario
        </button>
        <button
          onClick={handleExportar}
          disabled={!caballoId || !firmante.trim()}
          className="flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-500 disabled:opacity-50 px-5 py-2.5 text-sm font-medium text-white transition-colors"
        >
          <Printer size={15} /> Exportar PDF
        </button>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const sectionTitle = 'text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4'
const fieldWrapper = 'flex flex-col gap-1'
const labelClass   = 'text-xs font-medium text-slate-500'
const colHeader    = 'text-[10px] uppercase tracking-widest text-slate-400'

const base = 'rounded-lg border border-slate-300 bg-slate-100 text-sm text-slate-700 placeholder-slate-400 focus:border-amber-400 focus:outline-none px-3 py-2 w-full'
const inputClass    = base
const selectClass   = base
const textareaClass = `${base} resize-none`

// ── Dictamen options ──────────────────────────────────────────────────────────

const DICTAMEN_OPTS = [
  {
    value: 'apto',
    label: 'Apto para la venta',
    active:   'border-amber-500 bg-amber-100/30 text-amber-500',
    inactive: 'border-slate-300 bg-slate-100 text-slate-500 hover:border-slate-400',
  },
  {
    value: 'condicionado',
    label: 'Apto con observaciones',
    active:   'border-amber-600 bg-amber-50 text-amber-700',
    inactive: 'border-slate-300 bg-slate-100 text-slate-500 hover:border-slate-400',
  },
  {
    value: 'no_apto',
    label: 'No apto',
    active:   'border-rose-600 bg-rose-50 text-rose-700',
    inactive: 'border-slate-300 bg-slate-100 text-slate-500 hover:border-slate-400',
  },
]
