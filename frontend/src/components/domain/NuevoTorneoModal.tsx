import { useEffect, useState } from 'react'
import { X, AlertCircle, Trophy, Plus, Trash2, UserPlus } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { torneoService } from '../../services/torneoService'
import { getUsuarios, type UsuarioAdmin } from '../../services/adminService'
import { mensajeError } from '../../utils/error'
import type { NuevoJugadorPayload } from '../../types/torneo'

interface Props {
  onClose: () => void
  onSuccess?: (torneoId: string) => void
}

/**
 * Alta de torneo: nombre, temporada/fechas y jugadores participantes.
 *
 * El jugador se carga por nombre libre y puede linkearse a un usuario de la
 * sociedad, pero no lo necesita: en polo el jugador no siempre es usuario de
 * la plataforma.
 */
export default function NuevoTorneoModal({ onClose, onSuccess }: Props) {
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id) ?? ''

  const [nombre,      setNombre]      = useState('')
  const [temporada,   setTemporada]   = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin,    setFechaFin]    = useState('')
  const [notas,       setNotas]       = useState('')
  const [jugadores,   setJugadores]   = useState<NuevoJugadorPayload[]>([])

  const [nuevoJugador, setNuevoJugador] = useState('')
  const [usuarios,     setUsuarios]     = useState<UsuarioAdmin[]>([])
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')

  useEffect(() => {
    if (!sociedadId) return
    getUsuarios(sociedadId)
      .then((us) => setUsuarios(us.filter((u) => u.activo)))
      .catch(() => setUsuarios([]))   // el link a usuario es opcional: si falla, se cargan a mano
  }, [sociedadId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function agregarJugador(nombreJugador: string, usuarioId: string | null = null) {
    const limpio = nombreJugador.trim()
    if (!limpio) return
    if (jugadores.some((j) => j.nombre.toLowerCase() === limpio.toLowerCase())) {
      setError('Ese jugador ya está en la lista.')
      return
    }
    setError('')
    setJugadores((prev) => [...prev, { nombre: limpio, usuario_id: usuarioId }])
    setNuevoJugador('')
  }

  function quitarJugador(indice: number) {
    setJugadores((prev) => prev.filter((_, i) => i !== indice))
  }

  async function handleGuardar() {
    if (!nombre.trim()) { setError('El torneo necesita un nombre.'); return }
    if (jugadores.length === 0) { setError('Agregá al menos un jugador participante.'); return }
    if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
      setError('La fecha de fin no puede ser anterior a la de inicio.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const torneo = await torneoService.crear({
        sociedad_id:  sociedadId,
        nombre:       nombre.trim(),
        temporada:    temporada.trim() || null,
        fecha_inicio: fechaInicio || null,
        fecha_fin:    fechaFin || null,
        notas:        notas.trim() || null,
        jugadores,
      })
      onSuccess?.(torneo.id)
      onClose()
    } catch (e) {
      setError(mensajeError(e, 'Error al crear el torneo'))
    } finally {
      setSaving(false)
    }
  }

  // Usuarios de la sociedad que todavía no están en la lista de jugadores.
  const usuariosDisponibles = usuarios.filter(
    (u) => !jugadores.some((j) => j.usuario_id === u.id),
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-brand-500" />
            <h2 className="text-base font-semibold text-slate-900">Nuevo torneo</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <Campo label="Nombre del torneo">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Palermo 2026"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </Campo>

          <Campo label="Temporada (opcional)">
            <input
              value={temporada}
              onChange={(e) => setTemporada(e.target.value)}
              placeholder="Alta 2026"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Desde (opcional)">
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              />
            </Campo>
            <Campo label="Hasta (opcional)">
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              />
            </Campo>
          </div>

          <Campo label="Jugadores participantes">
            <div className="flex gap-2">
              <input
                value={nuevoJugador}
                onChange={(e) => setNuevoJugador(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); agregarJugador(nuevoJugador) }
                }}
                placeholder="Nombre del jugador"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              />
              <button
                type="button"
                onClick={() => agregarJugador(nuevoJugador)}
                className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                <Plus size={15} />
                Agregar
              </button>
            </div>

            {usuariosDisponibles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {usuariosDisponibles.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => agregarJugador(`${u.nombre} ${u.apellido}`, u.id)}
                    className="flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:border-brand-300 hover:text-brand-600"
                  >
                    <UserPlus size={12} />
                    {u.nombre} {u.apellido}
                  </button>
                ))}
              </div>
            )}

            {jugadores.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {jugadores.map((j, i) => (
                  <li
                    key={`${j.nombre}-${i}`}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"
                  >
                    <span>
                      {j.nombre}
                      {j.usuario_id && (
                        <span className="ml-2 text-xs text-slate-400">usuario del sistema</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => quitarJugador(i)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Campo>

          <Campo label="Notas (opcional)">
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </Campo>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex gap-2 border-t border-slate-100 bg-white px-5 py-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={saving}
            className="flex-1 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-400 disabled:opacity-50"
          >
            {saving ? 'Creando…' : 'Crear torneo'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  )
}
