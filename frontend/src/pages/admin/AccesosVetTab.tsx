import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldOff, Plus, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  getAccesosVet, revocarAcceso, otorgarAcceso,
  getUsuarios, getMarcas,
  type AccesoVet, type UsuarioAdmin, type MarcaAdmin,
} from '../../services/adminService'
import { MOCK_CABALLOS } from '../../dev/mockData'

// ── Modal otorgar acceso ──────────────────────────────────────────────────────

interface OtorgarModalProps {
  vets: UsuarioAdmin[]
  marcas: MarcaAdmin[]
  otorgadoPor: string
  onClose: () => void
  onSuccess: () => void
}

function OtorgarModal({ vets, marcas, otorgadoPor, onClose, onSuccess }: OtorgarModalProps) {
  const [vetId, setVetId] = useState(vets[0]?.id ?? '')
  const [tipo, setTipo] = useState<'masivo' | 'individual'>('masivo')
  const [marcaId, setMarcaId] = useState(marcas[0]?.id ?? '')
  const [caballoId, setCaballoId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const caballosDisponibles = marcaId
    ? MOCK_CABALLOS.filter((c) => c.marca_id === marcaId && c.activo)
    : []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!vetId) return setError('Seleccioná un veterinario.')
    if (tipo === 'masivo' && !marcaId) return setError('Seleccioná una marca.')
    if (tipo === 'individual' && !caballoId) return setError('Seleccioná un caballo.')
    setSaving(true)
    try {
      await otorgarAcceso(
        { vet_id: vetId, tipo, marca_id: tipo === 'masivo' ? marcaId : undefined, caballo_id: tipo === 'individual' ? caballoId : undefined },
        otorgadoPor
      )
      onSuccess()
    } catch {
      setError('No se pudo guardar el acceso.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
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

          {/* Tipo */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Tipo de acceso</label>
            <div className="flex gap-3">
              {(['masivo', 'individual'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
                    tipo === t
                      ? 'border-emerald-600 bg-emerald-900/30 text-emerald-300'
                      : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {t === 'masivo' ? 'Por marca' : 'Por caballo'}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-zinc-600">
              {tipo === 'masivo'
                ? 'El vet accede a todos los caballos actuales y futuros de la marca.'
                : 'El vet accede solo al caballo seleccionado.'}
            </p>
          </div>

          {/* Selector según tipo */}
          {tipo === 'masivo' ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Marca</label>
              <select
                value={marcaId}
                onChange={(e) => setMarcaId(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {marcas.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Caballo</label>
              <select
                value={marcaId}
                onChange={(e) => setMarcaId(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">— Filtrar por marca —</option>
                {marcas.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
              {marcaId && (
                <select
                  value={caballoId}
                  onChange={(e) => setCaballoId(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">— Seleccioná un caballo —</option>
                  {caballosDisponibles.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre} ({c.categoria})</option>
                  ))}
                </select>
              )}
            </div>
          )}

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
  const [accesos, setAccesos] = useState<AccesoVet[]>([])
  const [vets, setVets] = useState<UsuarioAdmin[]>([])
  const [marcas, setMarcas] = useState<MarcaAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [revocando, setRevocando] = useState<string | null>(null)

  async function cargar() {
    if (!sociedadActiva) return
    const [a, u, m] = await Promise.all([
      getAccesosVet(sociedadActiva.id),
      getUsuarios(sociedadActiva.id),
      getMarcas(sociedadActiva.id),
    ])
    setAccesos(a)
    setVets(u.filter((x) => x.rol === 'veterinario'))
    setMarcas(m)
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

      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900">
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Veterinario</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Tipo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Alcance</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {accesos.map((a) => (
              <tr key={a.id} className="hover:bg-zinc-900/50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-200">{a.vet.nombre} {a.vet.apellido}</p>
                  <p className="text-[11px] text-zinc-500 font-mono">{a.vet.email}</p>
                </td>
                <td className="px-4 py-3">
                  {a.marca_id ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-violet-900/30 text-violet-400">
                      <ShieldCheck size={11} /> Por marca
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-sky-900/30 text-sky-400">
                      <ShieldCheck size={11} /> Por caballo
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-zinc-300 text-xs">
                    {a.marca ? a.marca.nombre : a.caballo?.nombre ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleRevocar(a.id)}
                    disabled={revocando === a.id}
                    className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-rose-400 transition-colors disabled:opacity-40"
                    title="Revocar acceso"
                  >
                    <ShieldOff size={13} />
                    {revocando === a.id ? 'Revocando…' : 'Revocar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {accesos.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-zinc-600">
            No hay accesos activos. Usá el botón para otorgar uno.
          </p>
        )}
      </div>

      {showModal && (
        <OtorgarModal
          vets={vets}
          marcas={marcas}
          otorgadoPor={user?.id ?? ''}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); cargar() }}
        />
      )}
    </div>
  )
}
