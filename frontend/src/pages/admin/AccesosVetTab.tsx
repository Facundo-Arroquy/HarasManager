import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldOff, Plus, X, CheckSquare } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  getAccesosVet, revocarAccesosBulk, otorgarAccesosBulk,
  getUsuarios,
  type AccesoVet, type UsuarioAdmin,
} from '../../services/adminService'
import { caballoService, type Caballo } from '../../services/caballoService'

// ── Utilidad edad ─────────────────────────────────────────────────────────────

function calcularEdad(fechaNac: string): string {
  const hoy = new Date()
  // Parsear como fecha local (evita desfase UTC en Argentina)
  const [y, mo, d] = fechaNac.split('-').map(Number)
  const nac = new Date(y, mo - 1, d)
  const meses = (hoy.getFullYear() - nac.getFullYear()) * 12 + (hoy.getMonth() - nac.getMonth())
  if (meses <= 0) return '< 1m'
  const a = Math.floor(meses / 12)
  const m = meses % 12
  if (a === 0) return `${m}m`
  if (m === 0) return `${a}a`
  return `${a}a ${m}m`
}

// ── Modal otorgar acceso masivo ───────────────────────────────────────────────

interface OtorgarModalProps {
  vets: UsuarioAdmin[]
  caballos: Caballo[]
  accesoActivos: AccesoVet[]
  otorgadoPor: string
  onClose: () => void
  onSuccess: () => void
}

function OtorgarModal({ vets, caballos, accesoActivos, otorgadoPor, onClose, onSuccess }: OtorgarModalProps) {
  const [vetId, setVetId] = useState(vets[0]?.id ?? '')
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Ids de caballos que ya tienen acceso para el vet seleccionado
  const yaConAcceso = new Set(
    accesoActivos.filter((a) => a.vet_id === vetId).map((a) => a.caballo_id).filter(Boolean) as string[]
  )
  const disponibles = caballos.filter((c) => c.activo && !yaConAcceso.has(c.id))

  function toggleCaballo(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleTodos() {
    if (seleccionados.size === disponibles.length) {
      setSeleccionados(new Set())
    } else {
      setSeleccionados(new Set(disponibles.map((c) => c.id)))
    }
  }

  // Limpiar selección cuando cambia el vet
  function handleVetChange(id: string) {
    setVetId(id)
    setSeleccionados(new Set())
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!vetId) return setError('Seleccioná un veterinario.')
    if (seleccionados.size === 0) return setError('Seleccioná al menos un caballo.')
    setSaving(true)
    setError('')
    try {
      await otorgarAccesosBulk(vetId, Array.from(seleccionados), otorgadoPor)
      onSuccess()
    } catch {
      setError('No se pudo guardar el acceso.')
    } finally {
      setSaving(false)
    }
  }

  const todosSeleccionados = disponibles.length > 0 && seleccionados.size === disponibles.length

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4 shrink-0">
          <h2 className="text-sm font-semibold text-zinc-100">Otorgar acceso a veterinario</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 p-5 gap-4">
          {/* Selector vet */}
          <div className="space-y-1.5 shrink-0">
            <label className="text-xs font-medium text-zinc-400">Veterinario</label>
            <select
              value={vetId}
              onChange={(e) => handleVetChange(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {vets.map((v) => (
                <option key={v.id} value={v.id}>{v.nombre} {v.apellido} — {v.email}</option>
              ))}
            </select>
          </div>

          {/* Lista caballos con checkboxes */}
          <div className="flex flex-col flex-1 min-h-0 space-y-2">
            <div className="flex items-center justify-between shrink-0">
              <label className="text-xs font-medium text-zinc-400">
                Caballos disponibles
                {disponibles.length > 0 && (
                  <span className="ml-1.5 text-zinc-600">({disponibles.length})</span>
                )}
              </label>
              {disponibles.length > 1 && (
                <button
                  type="button"
                  onClick={toggleTodos}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  {todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              )}
            </div>

            {disponibles.length === 0 ? (
              <p className="text-xs text-zinc-500 py-4 text-center">
                Este veterinario ya tiene acceso a todos los caballos activos.
              </p>
            ) : (
              <div className="overflow-y-auto flex-1 rounded-md border border-zinc-800 divide-y divide-zinc-800">
                {disponibles.map((c) => {
                  const checked = seleccionados.has(c.id)
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                        checked ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCaballo(c.id)}
                        className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 accent-emerald-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-200 truncate">{c.nombre}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {c.numero_registro && (
                            <span className="text-[11px] text-zinc-500 font-mono">{c.numero_registro}</span>
                          )}
                          {c.fecha_nacimiento && (
                            <span className="text-[11px] text-zinc-500">
                              {calcularEdad(c.fecha_nacimiento)}
                            </span>
                          )}
                          {c.categoria && (
                            <span className="text-[10px] text-zinc-600 border border-zinc-700 rounded px-1.5 py-0.5">
                              {c.categoria}
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {error && <p className="text-xs text-rose-400 shrink-0">{error}</p>}

          <div className="flex justify-end gap-2 pt-1 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || seleccionados.size === 0}
              className="px-4 py-2 text-sm font-medium rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
            >
              {saving
                ? 'Guardando…'
                : seleccionados.size > 0
                  ? `Otorgar acceso a ${seleccionados.size} caballo${seleccionados.size !== 1 ? 's' : ''}`
                  : 'Otorgar acceso'}
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
  const [caballos, setCaballos] = useState<Caballo[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [revocandoIds, setRevocandoIds] = useState<Set<string>>(new Set())
  const [revocandoBulk, setRevocandoBulk] = useState(false)

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
    setSeleccionados(new Set())
  }

  useEffect(() => { cargar() }, [sociedadActiva]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSeleccion(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleTodos() {
    if (seleccionados.size === accesos.length) {
      setSeleccionados(new Set())
    } else {
      setSeleccionados(new Set(accesos.map((a) => a.id)))
    }
  }

  async function handleRevocarSeleccionados() {
    if (seleccionados.size === 0) return
    setRevocandoBulk(true)
    try {
      await revocarAccesosBulk(Array.from(seleccionados))
      await cargar()
    } finally {
      setRevocandoBulk(false)
    }
  }

  async function handleRevocarIndividual(id: string) {
    setRevocandoIds((prev) => new Set(prev).add(id))
    try {
      await revocarAccesosBulk([id])
      await cargar()
    } finally {
      setRevocandoIds((prev) => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  const anyRevocando = revocandoBulk || revocandoIds.size > 0

  if (loading) return <p className="text-sm text-zinc-500">Cargando accesos…</p>

  const todosSeleccionados = accesos.length > 0 && seleccionados.size === accesos.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-medium text-zinc-300">
          {accesos.length} acceso{accesos.length !== 1 ? 's' : ''} activo{accesos.length !== 1 ? 's' : ''}
        </h2>

        <div className="flex items-center gap-2">
          {seleccionados.size > 0 && (
            <button
              onClick={handleRevocarSeleccionados}
              disabled={anyRevocando}
              className="flex items-center gap-1.5 rounded-md border border-rose-800/50 bg-rose-900/20 hover:bg-rose-900/40 px-3 py-1.5 text-xs font-medium text-rose-400 transition-colors disabled:opacity-50"
            >
              <ShieldOff size={13} />
              {revocandoBulk ? 'Revocando…' : `Revocar ${seleccionados.size} seleccionado${seleccionados.size !== 1 ? 's' : ''}`}
            </button>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white transition-colors"
          >
            <Plus size={14} />
            Otorgar acceso
          </button>
        </div>
      </div>

      {accesos.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-600">
          No hay accesos activos. Usá el botón para otorgar uno.
        </p>
      ) : (
        <>
          {/* Selector todos */}
          <label className="flex items-center gap-2 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={todosSeleccionados}
              onChange={toggleTodos}
              className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 accent-emerald-500"
            />
            <span className="text-xs text-zinc-500">
              {todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </span>
          </label>

          <div className="rounded-xl border border-zinc-800 overflow-hidden divide-y divide-zinc-800">
            {accesos.map((a) => {
              const checked = seleccionados.has(a.id)
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${checked ? 'bg-zinc-800/70' : 'bg-zinc-900'}`}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSeleccion(a.id)}
                    className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 accent-emerald-500 shrink-0"
                  />

                  {/* Vet info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">
                      {a.vet.nombre} {a.vet.apellido}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-[11px] text-zinc-500 font-mono truncate">{a.vet.email}</p>
                      {a.caballo && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-sky-900/30 text-sky-400 shrink-0">
                          <ShieldCheck size={10} />
                          {a.caballo.nombre}
                          {a.caballo.numero_registro && (
                            <span className="font-mono opacity-70 ml-0.5">· {a.caballo.numero_registro}</span>
                          )}
                          {a.caballo.fecha_nacimiento && (
                            <span className="opacity-70 ml-0.5">· {calcularEdad(a.caballo.fecha_nacimiento)}</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Revocar individual */}
                  <button
                    onClick={() => handleRevocarIndividual(a.id)}
                    disabled={revocandoIds.has(a.id) || revocandoBulk}
                    className="shrink-0 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-rose-400 transition-colors disabled:opacity-40 py-1.5 px-2 rounded-md hover:bg-zinc-800"
                    title="Revocar acceso"
                  >
                    <ShieldOff size={14} />
                    <span className="hidden sm:inline">
                      {revocandoIds.has(a.id) ? 'Revocando…' : 'Revocar'}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {accesos.length > 0 && seleccionados.size > 0 && (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <CheckSquare size={13} className="text-emerald-500" />
          {seleccionados.size} de {accesos.length} seleccionado{seleccionados.size !== 1 ? 's' : ''}
        </div>
      )}

      {showModal && (
        <OtorgarModal
          vets={vets}
          caballos={caballos}
          accesoActivos={accesos}
          otorgadoPor={user?.id ?? ''}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); cargar() }}
        />
      )}
    </div>
  )
}
