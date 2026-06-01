import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldOff, Plus, X, CheckSquare } from 'lucide-react'
import Tooltip from '../../components/ui/Tooltip'
import { useAuth } from '../../hooks/useAuth'
import {
  getAccesosVet, revocarAccesosBulk, otorgarAccesosBulk,
  getVeterinariosPlataforma,
  type AccesoVet, type VeterinarioPlataforma,
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
  vets: VeterinarioPlataforma[]
  caballos: Caballo[]
  accesoActivos: AccesoVet[]
  otorgadoPor: string
  vetError: string | null
  onClose: () => void
  onSuccess: () => void
}

function OtorgarModal({ vets, caballos, accesoActivos, otorgadoPor, vetError, onClose, onSuccess }: OtorgarModalProps) {
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
    } catch (err: any) {
      const msg = err?.message ?? err?.error_description ?? JSON.stringify(err)
      setError(`Error: ${msg}`)
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
      <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl border border-slate-300 bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 shrink-0">
          <h2 className="text-sm font-semibold text-slate-900">Otorgar acceso a veterinario</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
        </div>

        {vets.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <ShieldCheck size={28} className="text-slate-300" />
            {vetError ? (
              <>
                <p className="text-sm font-medium text-rose-600">Error al cargar veterinarios</p>
                <p className="text-xs text-slate-400 font-mono bg-slate-50 rounded p-2 max-w-xs break-all">{vetError}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-600">No hay veterinarios registrados en la plataforma</p>
                <p className="text-xs text-slate-400 max-w-xs">
                  Los veterinarios se registran a nivel plataforma con el rol <span className="font-medium text-brand-600">Veterinario</span>.
                </p>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="mt-1 px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Cerrar
            </button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 p-5 gap-4">
          {/* Selector vet */}
          <div className="space-y-1.5 shrink-0">
            <label className="text-xs font-medium text-slate-500">Veterinario</label>
            <select
              value={vetId}
              onChange={(e) => handleVetChange(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {vets.map((v) => (
                <option key={v.id} value={v.id}>{v.nombre} {v.apellido} — {v.email}</option>
              ))}
            </select>
          </div>

          {/* Lista caballos con checkboxes */}
          <div className="flex flex-col flex-1 min-h-0 space-y-2">
            <div className="flex items-center justify-between shrink-0">
              <label className="text-xs font-medium text-slate-500">
                Caballos disponibles
                {disponibles.length > 0 && (
                  <span className="ml-1.5 text-slate-400">({disponibles.length})</span>
                )}
              </label>
              {disponibles.length > 1 && (
                <button
                  type="button"
                  onClick={toggleTodos}
                  className="text-[11px] text-brand-600 hover:text-brand-500 transition-colors"
                >
                  {todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              )}
            </div>

            {disponibles.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                Este veterinario ya tiene acceso a todos los caballos activos.
              </p>
            ) : (
              <div className="overflow-y-auto flex-1 rounded-md border border-slate-200 divide-y divide-slate-200">
                {disponibles.map((c) => {
                  const checked = seleccionados.has(c.id)
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                        checked ? 'bg-slate-100' : 'hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCaballo(c.id)}
                        className="h-4 w-4 rounded border-slate-400 bg-slate-100 text-brand-500 accent-emerald-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-700 truncate">{c.nombre}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {c.numero_registro && (
                            <span className="text-[11px] text-slate-400 font-mono">{c.numero_registro}</span>
                          )}
                          {c.fecha_nacimiento && (
                            <span className="text-[11px] text-slate-400">
                              {calcularEdad(c.fecha_nacimiento)}
                            </span>
                          )}
                          {c.categoria && (
                            <span className="text-[10px] text-slate-400 border border-slate-300 rounded px-1.5 py-0.5">
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

          {error && <p className="text-xs text-rose-600 shrink-0">{error}</p>}

          <div className="flex justify-end gap-2 pt-1 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || seleccionados.size === 0}
              className="px-4 py-2 text-sm font-medium rounded-md bg-brand-500 hover:bg-brand-400 text-white transition-colors disabled:opacity-50"
            >
              {saving
                ? 'Guardando…'
                : seleccionados.size > 0
                  ? `Otorgar acceso a ${seleccionados.size} caballo${seleccionados.size !== 1 ? 's' : ''}`
                  : 'Otorgar acceso'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  )
}

// ── Tab principal ─────────────────────────────────────────────────────────────

export default function AccesosVetTab() {
  const { sociedadActiva, user } = useAuth()
  const [accesos,  setAccesos]  = useState<AccesoVet[]>([])
  const [vets,     setVets]     = useState<VeterinarioPlataforma[]>([])
  const [caballos, setCaballos] = useState<Caballo[]>([])
  const [loading,  setLoading]  = useState(true)
  const [vetError, setVetError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [revocandoIds, setRevocandoIds] = useState<Set<string>>(new Set())
  const [revocandoBulk, setRevocandoBulk] = useState(false)

  async function cargar() {
    if (!sociedadActiva) return
    setVetError(null)

    // Cargar accesos y caballos — no dependen de los vets de plataforma
    const [accesoResult, caballoResult] = await Promise.allSettled([
      getAccesosVet(sociedadActiva.id),
      caballoService.listar(sociedadActiva.id),
    ])
    if (accesoResult.status === 'fulfilled') setAccesos(accesoResult.value)
    if (caballoResult.status === 'fulfilled') setCaballos(caballoResult.value)

    // Cargar vets de plataforma por separado para capturar el error real
    try {
      const vetsPlat = await getVeterinariosPlataforma()
      setVets(vetsPlat)
    } catch (err: any) {
      const msg = err?.message ?? JSON.stringify(err)
      console.error('[AccesosVetTab] Error al cargar vets:', msg)
      setVetError(msg)
    }

    setSeleccionados(new Set())
    setLoading(false)
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

  if (loading) return <p className="text-sm text-slate-400">Cargando accesos…</p>

  const todosSeleccionados = accesos.length > 0 && seleccionados.size === accesos.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-slate-600">
            {accesos.length} acceso{accesos.length !== 1 ? 's' : ''} activo{accesos.length !== 1 ? 's' : ''}
          </h2>
          <Tooltip text="Los veterinarios solo pueden ver y registrar consultas en los caballos a los que se les dio acceso explícito desde acá." />
        </div>

        <div className="flex items-center gap-2">
          {seleccionados.size > 0 && (
            <div className="flex items-center gap-1">
              <button
                onClick={handleRevocarSeleccionados}
                disabled={anyRevocando}
                className="flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors disabled:opacity-50"
              >
                <ShieldOff size={13} />
                {revocandoBulk ? 'Revocando…' : `Revocar ${seleccionados.size} seleccionado${seleccionados.size !== 1 ? 's' : ''}`}
              </button>
              <Tooltip text="Quita el acceso del veterinario a estos caballos. No borra el historial clínico ya registrado." />
            </div>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 rounded-md bg-brand-500 hover:bg-brand-400 px-3 py-1.5 text-xs font-medium text-white transition-colors"
          >
            <Plus size={14} />
            Otorgar acceso
          </button>
        </div>
      </div>

      {accesos.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
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
              className="h-4 w-4 rounded border-slate-400 bg-slate-100 accent-emerald-500"
            />
            <span className="text-xs text-slate-400">
              {todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </span>
          </label>

          <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-200">
            {accesos.map((a) => {
              const checked = seleccionados.has(a.id)
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${checked ? 'bg-slate-100/70' : 'bg-white'}`}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSeleccion(a.id)}
                    className="h-4 w-4 rounded border-slate-400 bg-slate-100 accent-emerald-500 shrink-0"
                  />

                  {/* Vet info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">
                      {a.vet.nombre} {a.vet.apellido}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-[11px] text-slate-400 font-mono truncate">{a.vet.email}</p>
                      {a.caballo && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-600 shrink-0">
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
                    className="shrink-0 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-40 py-1.5 px-2 rounded-md hover:bg-slate-100"
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
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <CheckSquare size={13} className="text-brand-500" />
          {seleccionados.size} de {accesos.length} seleccionado{seleccionados.size !== 1 ? 's' : ''}
        </div>
      )}

      {showModal && (
        <OtorgarModal
          vets={vets}
          caballos={caballos}
          accesoActivos={accesos}
          otorgadoPor={user?.id ?? ''}
          vetError={vetError}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); cargar() }}
        />
      )}
    </div>
  )
}
