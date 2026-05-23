import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldOff, Plus, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  getAccesosVet, revocarAcceso, otorgarAcceso,
  getUsuarios,
  type AccesoVet, type UsuarioAdmin,
} from '../../services/adminService'
import { caballoService } from '../../services/caballoService'

// ── Modal otorgar acceso ──────────────────────────────────────────────────────

interface OtorgarModalProps {
  vets: UsuarioAdmin[]
  caballos: { id: string; nombre: string; categoria?: string | null }[]
  otorgadoPor: string
  onClose: () => void
  onSuccess: () => void
}

function OtorgarModal({ vets, caballos, otorgadoPor, onClose, onSuccess }: OtorgarModalProps) {
  const [vetId, setVetId] = useState(vets[0]?.id ?? '')
  const [caballoId, setCaballoId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!vetId) return setError('Seleccioná un veterinario.')
    if (!caballoId) return setError('Seleccioná un caballo.')
    setSaving(true)
    try {
      await otorgarAcceso({ vet_id: vetId, caballo_id: caballoId }, otorgadoPor)
      onSuccess()
    } catch {
      setError('No se pudo guardar el acceso.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-100">Otorgar acceso a veterinario</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Veterinario */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Veterinario</label>
            <select
              value={vetId}
              onChange={(e) => setVetId(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {vets.map((v) => (
                <option key={v.id} value={v.id}>{v.nombre} {v.apellido} — {v.email}</option>
              ))}
            </select>
          </div>

          {/* Caballo */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Caballo</label>
            <select
              value={caballoId}
              onChange={(e) => setCaballoId(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">— Seleccioná un caballo —</option>
              {caballos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}{c.categoria ? ` (${c.categoria})` : ''}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Otorgar acceso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Tab principal ─────────────────────────────────────────────────────────────

export default function AccesosVetTab() {
  const { sociedadActiva, user } = useAuth()
  const [accesos,  setAccesos]  = useState<AccesoVet[]>([])
  const [vets,     setVets]     = useState<UsuarioAdmin[]>([])
  const [caballos, setCaballos] = useState<{ id: string; nombre: string; categoria?: string | null }[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [revocando, setRevocando] = useState<string | null>(null)

  async function cargar() {
    if (!sociedadActiva) return
    const [a, u, c] = await Promise.all([
      getAccesosVet(sociedadActiva.id),
      getUsuarios(sociedadActiva.id),
      caballoService.listar(sociedadActiva.id),
    ])
    setAccesos(a)
    setVets(u.filter((x) => x.rol === 'veterinario'))
    setCaballos(c)
    setLoading(false)
  }

  useEffect(() => { cargar() }, [sociedadActiva]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRevocar(id: string) {
    setRevocando(id)
    try {
      await revocarAcceso(id)
      await cargar()
    } finally {
      setRevocando(null)
    }
  }

  if (loading) return <p className="text-sm text-zinc-500">Cargando accesos…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-300">
          {accesos.length} acceso{accesos.length !== 1 ? 's' : ''} activo{accesos.length !== 1 ? 's' : ''}
        </h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white transition-colors"
        >
          <Plus size={14} />
          Otorgar acceso
        </button>
      </div>

      {accesos.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-600">
          No hay accesos activos. Usá el botón para otorgar uno.
        </p>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden divide-y divide-zinc-800">
          {accesos.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3 bg-zinc-900">
              {/* Vet info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">
                  {a.vet.nombre} {a.vet.apellido}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <p className="text-[11px] text-zinc-500 font-mono truncate">{a.vet.email}</p>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-sky-900/30 text-sky-400 shrink-0">
                    <ShieldCheck size={10} /> {a.caballo?.nombre ?? '—'}
                  </span>
                </div>
              </div>
              {/* Revocar */}
              <button
                onClick={() => handleRevocar(a.id)}
                disabled={revocando === a.id}
                className="shrink-0 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-rose-400 transition-colors disabled:opacity-40 py-1.5 px-2 rounded-md hover:bg-zinc-800"
                title="Revocar acceso"
              >
                <ShieldOff size={14} />
                <span className="hidden sm:inline">{revocando === a.id ? 'Revocando…' : 'Revocar'}</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <OtorgarModal
          vets={vets}
          caballos={caballos}
          otorgadoPor={user?.id ?? ''}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); cargar() }}
        />
      )}
    </div>
  )
}
