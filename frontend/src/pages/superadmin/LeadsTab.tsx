import { useState, useEffect, useRef } from 'react'
import { X, Plus, RefreshCw, ExternalLink, MessageCircle } from 'lucide-react'
import {
  type LeadCompleto,
  type LeadEstado,
  type LeadManualInput,
  crearLeadManual,
  actualizarLead,
} from '../../services/leadsService'
import { getSupabaseClient } from '../../lib/supabase'
import Spinner from '../../components/ui/Spinner'

// ─── Config de estados ────────────────────────────────────────────────────────

const ESTADOS: LeadEstado[] = [
  'nuevo', 'contactado', 'demo_agendada', 'demo_realizada', 'convertido', 'perdido',
]

const ESTADO_CFG: Record<LeadEstado, { label: string; bg: string; text: string; border: string }> = {
  nuevo:          { label: 'Nuevo',          bg: 'rgba(63,63,70,0.6)',   text: '#a1a1aa', border: '#52525b' },
  contactado:     { label: 'Contactado',     bg: 'rgba(30,58,95,0.5)',   text: '#60a5fa', border: '#1d4ed8' },
  demo_agendada:  { label: 'Demo agendada',  bg: 'rgba(69,26,3,0.6)',    text: '#fbbf24', border: '#d97706' },
  demo_realizada: { label: 'Demo realizada', bg: 'rgba(59,7,100,0.5)',   text: '#c084fc', border: '#9333ea' },
  convertido:     { label: 'Convertido',     bg: 'rgba(5,46,22,0.6)',    text: '#4ade80', border: '#16a34a' },
  perdido:        { label: 'Perdido',        bg: 'rgba(28,0,0,0.5)',     text: '#f87171', border: '#dc2626' },
}

const MODULOS = [
  'Fichas de animales', 'Historial clínico', 'Centro de cría',
  'Alertas sanitarias', 'Árbol genealógico', 'Revisión pre-venta',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function waLink(tel: string): string {
  const clean = tel.replace(/\D/g, '')
  const num = clean.startsWith('0') ? '54' + clean.slice(1) : clean
  return `https://wa.me/${num}`
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Barra de funnel ──────────────────────────────────────────────────────────

function FunnelBar({
  leads,
  filtro,
  onSelect,
}: {
  leads: LeadCompleto[]
  filtro: LeadEstado | null
  onSelect: (e: LeadEstado | null) => void
}) {
  const counts = ESTADOS.reduce<Record<LeadEstado, number>>((acc, e) => {
    acc[e] = leads.filter((l) => l.estado === e).length
    return acc
  }, {} as Record<LeadEstado, number>)

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors border ${
          filtro === null
            ? 'bg-zinc-700 border-zinc-500 text-zinc-100'
            : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'
        }`}
      >
        Todos ({leads.length})
      </button>
      {ESTADOS.map((e) => {
        const c = ESTADO_CFG[e]
        const active = filtro === e
        return (
          <button
            key={e}
            onClick={() => onSelect(active ? null : e)}
            className="px-3 py-1.5 rounded text-xs font-semibold transition-all border"
            style={
              active
                ? { backgroundColor: c.bg, color: c.text, borderColor: c.border }
                : { backgroundColor: 'transparent', color: '#71717a', borderColor: '#3f3f46' }
            }
          >
            {c.label} ({counts[e]})
          </button>
        )
      })}
    </div>
  )
}

// ─── Modal nuevo lead (carga manual) ─────────────────────────────────────────

const MANUAL_INICIAL: LeadManualInput = {
  nombre: '', email: '', telefono: '', nombre_establecimiento: '',
  cantidad_animales: '', modulos_interes: [], mensaje: '',
  estado: 'nuevo', responsable: '', notas: '',
}

function NuevoLeadModal({ onClose, onCreado }: { onClose: () => void; onCreado: () => void }) {
  const [form, setForm] = useState<LeadManualInput>(MANUAL_INICIAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function toggleModulo(m: string) {
    setForm((p) => ({
      ...p,
      modulos_interes: p.modulos_interes.includes(m)
        ? p.modulos_interes.filter((x) => x !== m)
        : [...p.modulos_interes, m],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await crearLeadManual(form)
      onCreado()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear lead.')
      setLoading(false)
    }
  }

  const inputCls = 'w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500'
  const labelCls = 'block text-xs font-medium text-zinc-400 mb-1'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4 sticky top-0 bg-zinc-900 z-10">
          <h2 className="text-sm font-semibold text-zinc-100">Nuevo lead</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Nombre y apellido *</label>
              <input type="text" required value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} className={inputCls} placeholder="Juan García" />
            </div>
            <div>
              <label className={labelCls}>Email *</label>
              <input type="email" required value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className={inputCls} placeholder="juan@haras.com" />
            </div>
            <div>
              <label className={labelCls}>Teléfono (WhatsApp)</label>
              <input type="tel" value={form.telefono} onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))} className={inputCls} placeholder="+54 9 11..." />
            </div>
            <div>
              <label className={labelCls}>Establecimiento *</label>
              <input type="text" required value={form.nombre_establecimiento} onChange={(e) => setForm((p) => ({ ...p, nombre_establecimiento: e.target.value }))} className={inputCls} placeholder="Haras La Estrella" />
            </div>
            <div>
              <label className={labelCls}>Cantidad de animales</label>
              <select value={form.cantidad_animales} onChange={(e) => setForm((p) => ({ ...p, cantidad_animales: e.target.value }))} className={inputCls}>
                <option value="">Seleccioná</option>
                <option value="1-20">1 – 20</option>
                <option value="21-50">21 – 50</option>
                <option value="51-100">51 – 100</option>
                <option value="+100">Más de 100</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Estado inicial</label>
              <select value={form.estado} onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value as LeadEstado }))} className={inputCls}>
                {ESTADOS.map((s) => <option key={s} value={s}>{ESTADO_CFG[s].label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Responsable</label>
              <input type="text" value={form.responsable} onChange={(e) => setForm((p) => ({ ...p, responsable: e.target.value }))} className={inputCls} placeholder="Tomás / Facundo" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Módulos de interés</label>
            <div className="grid grid-cols-2 gap-1.5">
              {MODULOS.map((m) => (
                <label key={m} className={`flex items-center gap-2 text-xs cursor-pointer px-2 py-1.5 rounded border transition-colors ${form.modulos_interes.includes(m) ? 'border-emerald-700/50 bg-emerald-900/30 text-emerald-400' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                  <input type="checkbox" checked={form.modulos_interes.includes(m)} onChange={() => toggleModulo(m)} className="accent-emerald-500 w-3 h-3" />
                  {m}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Notas internas</label>
            <textarea value={form.notas} onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))} rows={3} className={`${inputCls} resize-none`} placeholder="Contexto, origen del contacto..." />
          </div>

          <div>
            <label className={labelCls}>Mensaje del lead</label>
            <textarea value={form.mensaje} onChange={(e) => setForm((p) => ({ ...p, mensaje: e.target.value }))} rows={2} className={`${inputCls} resize-none`} placeholder="Lo que nos escribió..." />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-zinc-700 py-2 text-xs text-zinc-400 hover:bg-zinc-800 transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-emerald-700 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors">
              {loading ? 'Creando...' : 'Crear lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal detalle / edición de notas ─────────────────────────────────────────

function DetalleModal({
  lead,
  onClose,
  onActualizado,
}: {
  lead: LeadCompleto
  onClose: () => void
  onActualizado: (id: string, campos: Partial<LeadCompleto>) => void
}) {
  const [estado, setEstado] = useState<LeadEstado>(lead.estado)
  const [responsable, setResponsable] = useState(lead.responsable ?? '')
  const [telefono, setTelefono] = useState(lead.telefono ?? '')
  const [notas, setNotas] = useState(lead.notas ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleGuardar() {
    setSaving(true)
    try {
      await actualizarLead(lead.id, { estado, responsable: responsable || null, telefono: telefono || null, notas: notas || null })
      onActualizado(lead.id, { estado, responsable: responsable || null, telefono: telefono || null, notas: notas || null })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // error silencioso — mejorable con toast
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500'
  const labelCls = 'block text-xs font-medium text-zinc-500 mb-1'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4 sticky top-0 bg-zinc-900 z-10">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">{lead.nombre}</h2>
            <p className="text-[11px] text-zinc-500">{lead.nombre_establecimiento}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Info readonly */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={labelCls}>Email</p>
              <a href={`mailto:${lead.email}`} className="text-xs text-emerald-400 hover:underline">{lead.email}</a>
            </div>
            <div>
              <p className={labelCls}>Cantidad de animales</p>
              <p className="text-xs text-zinc-300">{lead.cantidad_animales ?? '—'}</p>
            </div>
            <div className="col-span-2">
              <p className={labelCls}>Módulos de interés</p>
              <div className="flex flex-wrap gap-1">
                {(lead.modulos_interes ?? []).length > 0
                  ? (lead.modulos_interes ?? []).map((m) => (
                    <span key={m} className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">{m}</span>
                  ))
                  : <span className="text-xs text-zinc-600">—</span>
                }
              </div>
            </div>
            {lead.mensaje && (
              <div className="col-span-2">
                <p className={labelCls}>Mensaje original</p>
                <p className="text-xs text-zinc-400 leading-relaxed">{lead.mensaje}</p>
              </div>
            )}
          </div>

          <div className="border-t border-zinc-800" />

          {/* Campos editables */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Estado</label>
                <select value={estado} onChange={(e) => setEstado(e.target.value as LeadEstado)} className={inputCls}>
                  {ESTADOS.map((s) => <option key={s} value={s}>{ESTADO_CFG[s].label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Responsable</label>
                <input type="text" value={responsable} onChange={(e) => setResponsable(e.target.value)} className={inputCls} placeholder="Tomás / Facundo" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Teléfono (WhatsApp)</label>
              <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} className={inputCls} placeholder="+54 9 11..." />
            </div>
            <div>
              <label className={labelCls}>Notas internas</label>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={4} className={`${inputCls} resize-none`} placeholder="Seguimiento, próximos pasos..." />
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 rounded-lg border border-zinc-700 py-2 text-xs text-zinc-400 hover:bg-zinc-800 transition-colors">Cerrar</button>
            <button
              onClick={handleGuardar}
              disabled={saving}
              className="flex-1 rounded-lg bg-emerald-700 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
            >
              {saved ? '✓ Guardado' : saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── LEADS TAB (principal) ────────────────────────────────────────────────────

export default function LeadsTab() {
  const [leads, setLeads] = useState<LeadCompleto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<LeadEstado | null>(null)
  const [showNuevo, setShowNuevo] = useState(false)
  const [detalle, setDetalle] = useState<LeadCompleto | null>(null)

  // Edición inline de responsable
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function cargarLeads() {
    setLoading(true)
    setError(null)
    try {
      const supabase = getSupabaseClient()
      const { data, error: err } = await supabase
        .from('lead')
        .select('*')
        .order('created_at', { ascending: false })
      if (err) throw err
      setLeads((data ?? []) as LeadCompleto[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar leads.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargarLeads() }, [])

  // Inline: cambio de estado
  async function handleEstado(id: string, estado: LeadEstado) {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, estado } : l))
    try {
      await actualizarLead(id, { estado })
    } catch {
      await cargarLeads() // revert
    }
  }

  // Inline: edición de responsable
  function startEditResponsable(lead: LeadCompleto) {
    setEditingId(lead.id)
    setEditValue(lead.responsable ?? '')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  async function saveResponsable(id: string) {
    const val = editValue.trim() || null
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, responsable: val } : l))
    setEditingId(null)
    try {
      await actualizarLead(id, { responsable: val })
    } catch {
      await cargarLeads()
    }
  }

  function handleActualizado(id: string, campos: Partial<LeadCompleto>) {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, ...campos } : l))
    if (detalle?.id === id) setDetalle((prev) => prev ? { ...prev, ...campos } : prev)
  }

  const leadsVisibles = filtro ? leads.filter((l) => l.estado === filtro) : leads

  return (
    <div className="space-y-4">
      {/* Funnel + acciones */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <FunnelBar leads={leads} filtro={filtro} onSelect={setFiltro} />
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setShowNuevo(true)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors"
          >
            <Plus size={12} /> Nuevo lead
          </button>
          <button
            onClick={cargarLeads}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          >
            <RefreshCw size={12} /> Actualizar
          </button>
        </div>
      </div>

      {loading && <div className="flex justify-center py-12"><Spinner size="lg" /></div>}

      {error && (
        <div className="rounded-lg border border-red-800/50 bg-red-900/20 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {!loading && !error && leadsVisibles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
          <p className="text-sm">{filtro ? `No hay leads en "${ESTADO_CFG[filtro].label}".` : 'Todavía no hay leads.'}</p>
        </div>
      )}

      {!loading && leadsVisibles.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                {['Contacto', 'Email', 'Establecimiento', 'Módulos', 'Estado', 'Responsable', 'Origen', 'Fecha', ''].map((h) => (
                  <th key={h} className="px-3 py-3 text-left font-medium text-zinc-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leadsVisibles.map((lead, i) => (
                <tr
                  key={lead.id}
                  className={`border-b border-zinc-800/50 ${i % 2 === 0 ? 'bg-zinc-950' : 'bg-zinc-900/30'} hover:bg-zinc-800/30 transition-colors`}
                >
                  {/* Nombre + WhatsApp */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="font-medium text-zinc-200">{lead.nombre}</div>
                    {lead.telefono && (
                      <a
                        href={waLink(lead.telefono)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-emerald-500 hover:text-emerald-400 mt-0.5"
                      >
                        <MessageCircle size={10} />
                        <span className="text-[10px]">{lead.telefono}</span>
                      </a>
                    )}
                  </td>

                  {/* Email */}
                  <td className="px-3 py-3">
                    <a href={`mailto:${lead.email}`} className="text-blue-400 hover:underline whitespace-nowrap">{lead.email}</a>
                  </td>

                  {/* Establecimiento + animales */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="text-zinc-300">{lead.nombre_establecimiento}</div>
                    {lead.cantidad_animales && <div className="text-zinc-500 text-[10px]">{lead.cantidad_animales} animales</div>}
                  </td>

                  {/* Módulos */}
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[180px]">
                      {(lead.modulos_interes ?? []).slice(0, 2).map((m) => (
                        <span key={m} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 whitespace-nowrap">{m}</span>
                      ))}
                      {(lead.modulos_interes ?? []).length > 2 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-500">+{(lead.modulos_interes ?? []).length - 2}</span>
                      )}
                    </div>
                  </td>

                  {/* Estado inline */}
                  <td className="px-3 py-3">
                    <select
                      value={lead.estado}
                      onChange={(e) => handleEstado(lead.id, e.target.value as LeadEstado)}
                      className="rounded px-2 py-1 text-[10px] font-semibold cursor-pointer border focus:outline-none"
                      style={{
                        backgroundColor: ESTADO_CFG[lead.estado].bg,
                        color: ESTADO_CFG[lead.estado].text,
                        borderColor: ESTADO_CFG[lead.estado].border,
                      }}
                    >
                      {ESTADOS.map((s) => <option key={s} value={s}>{ESTADO_CFG[s].label}</option>)}
                    </select>
                  </td>

                  {/* Responsable inline */}
                  <td className="px-3 py-3">
                    {editingId === lead.id ? (
                      <input
                        ref={inputRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => saveResponsable(lead.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveResponsable(lead.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="w-24 rounded bg-zinc-800 border border-zinc-600 px-2 py-0.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-400"
                      />
                    ) : (
                      <button
                        onClick={() => startEditResponsable(lead)}
                        className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors text-left"
                      >
                        {lead.responsable ?? <span className="text-zinc-600">—</span>}
                      </button>
                    )}
                  </td>

                  {/* Origen */}
                  <td className="px-3 py-3">
                    <span
                      className={`text-[9px] font-semibold px-2 py-0.5 rounded border ${
                        lead.origen === 'landing'
                          ? 'bg-amber-900/30 text-amber-400 border-amber-700/50'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}
                    >
                      {lead.origen}
                    </span>
                  </td>

                  {/* Fecha */}
                  <td className="px-3 py-3 text-zinc-500 whitespace-nowrap">{formatFecha(lead.created_at)}</td>

                  {/* Acción */}
                  <td className="px-3 py-3">
                    <button
                      onClick={() => setDetalle(lead)}
                      className="text-zinc-500 hover:text-zinc-200 transition-colors"
                      title="Ver detalle y notas"
                    >
                      <ExternalLink size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNuevo && (
        <NuevoLeadModal
          onClose={() => setShowNuevo(false)}
          onCreado={() => { setShowNuevo(false); cargarLeads() }}
        />
      )}

      {detalle && (
        <DetalleModal
          lead={detalle}
          onClose={() => setDetalle(null)}
          onActualizado={handleActualizado}
        />
      )}
    </div>
  )
}
