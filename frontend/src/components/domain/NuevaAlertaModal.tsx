import { useState, useMemo } from 'react'
import { X, Bell, Search, Plus, Trash2 } from 'lucide-react'
import { alertaService } from '../../services/alertaService'
import { useAuthStore } from '../../store/authStore'

interface Caballo {
  id: string
  nombre: string
  categoria?: string
}

interface FilaAlerta {
  id: number
  motivo: string
  dias: number | ''
}

interface Props {
  caballos: Caballo[]
  onClose: () => void
  onSuccess: () => void
}

let nextId = 1

function fechaDesdeHoy(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

export default function NuevaAlertaModal({ caballos, onClose, onSuccess }: Props) {
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id ?? null)
  const userId     = useAuthStore((s) => s.user?.id)

  const [filas, setFilas] = useState<FilaAlerta[]>([{ id: nextId++, motivo: '', dias: 30 }])
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [busqueda, setBusqueda] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // ── Filas ────────────────────────────────────────────────────────────────────

  function agregarFila() {
    setFilas((prev) => [...prev, { id: nextId++, motivo: '', dias: 30 }])
  }

  function eliminarFila(id: number) {
    setFilas((prev) => prev.filter((f) => f.id !== id))
  }

  function updateFila(id: number, campo: 'motivo' | 'dias', valor: string | number | '') {
    setFilas((prev) =>
      prev.map((f) => f.id === id ? { ...f, [campo]: valor } : f)
    )
  }

  // ── Caballos ─────────────────────────────────────────────────────────────────

  const filtrados = useMemo(
    () => caballos.filter((c) => c.nombre.toLowerCase().includes(busqueda.toLowerCase())),
    [caballos, busqueda]
  )

  function toggleCaballo(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleTodos() {
    const todosVisible = filtrados.every((c) => seleccionados.has(c.id))
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (todosVisible) filtrados.forEach((c) => next.delete(c.id))
      else filtrados.forEach((c) => next.add(c.id))
      return next
    })
  }

  // ── Validación ───────────────────────────────────────────────────────────────

  const filasValidas = filas.filter(
    (f) => f.motivo.trim().length > 0 && f.dias !== '' && Number(f.dias) > 0
  )

  const puedeGuardar = filasValidas.length > 0 && seleccionados.size > 0

  // ── Guardar ──────────────────────────────────────────────────────────────────

  async function handleGuardar() {
    if (!puedeGuardar || !userId) return
    setError('')
    setGuardando(true)
    try {
      await alertaService.crearMultiples({
        sociedad_id: sociedadId,
        alertas:     filasValidas.map((f) => ({ motivo: f.motivo.trim(), dias: Number(f.dias) })),
        caballo_ids: Array.from(seleccionados),
        creado_por:  userId,
      })
      onSuccess()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar las alertas.')
    } finally {
      setGuardando(false)
    }
  }

  const todosVisibleSeleccionados = filtrados.length > 0 && filtrados.every((c) => seleccionados.has(c.id))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4">
      <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl flex flex-col max-h-[92vh]">

        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
              <Bell size={16} className="text-amber-600" />
            </div>
            <h2 className="text-base font-bold text-slate-800">Crear alertas</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5" style={{ minHeight: 0 }}>

          {/* ── Sección alertas ──────────────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Alertas a crear
            </p>

            <div className="space-y-2">
              {filas.map((fila, idx) => (
                <div
                  key={fila.id}
                  className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
                >
                  {/* Número */}
                  <span className="mt-2 text-xs font-semibold text-slate-400 w-4 text-center shrink-0">
                    {idx + 1}
                  </span>

                  <div className="flex-1 space-y-2">
                    {/* Motivo */}
                    <input
                      type="text"
                      value={fila.motivo}
                      onChange={(e) => updateFila(fila.id, 'motivo', e.target.value)}
                      placeholder="Motivo (ej: Vacuna Antirrábica)"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />

                    {/* Días + fecha estimada */}
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={9999}
                        value={fila.dias}
                        onChange={(e) =>
                          updateFila(fila.id, 'dias', e.target.value === '' ? '' : Number(e.target.value))
                        }
                        className="w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                      <span className="text-xs text-slate-500">días</span>
                      {fila.dias !== '' && Number(fila.dias) > 0 && (
                        <span className="text-xs text-slate-400">
                          → {fechaDesdeHoy(Number(fila.dias))}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Eliminar fila */}
                  {filas.length > 1 && (
                    <button
                      onClick={() => eliminarFila(fila.id)}
                      className="mt-1.5 p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={agregarFila}
              className="flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors px-1"
            >
              <Plus size={14} />
              Agregar otra alerta
            </button>
          </div>

          {/* ── Sección caballos ─────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Caballos{seleccionados.size > 0 && (
                  <span className="ml-1.5 normal-case font-normal text-amber-600">
                    ({seleccionados.size} seleccionado{seleccionados.size !== 1 ? 's' : ''})
                  </span>
                )}
              </p>
              {filtrados.length > 0 && (
                <button
                  type="button"
                  onClick={toggleTodos}
                  className="text-xs text-amber-600 hover:text-amber-700 transition-colors"
                >
                  {todosVisibleSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              )}
            </div>

            {/* Buscador */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar caballo…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm text-slate-700 placeholder-slate-400 focus:border-amber-400 focus:outline-none"
              />
            </div>

            {/* Lista checkboxes */}
            <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 max-h-52 overflow-y-auto">
              {caballos.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-400">No hay caballos disponibles</p>
              )}
              {caballos.length > 0 && filtrados.length === 0 && (
                <p className="py-4 text-center text-sm text-slate-400">Sin resultados</p>
              )}
              {filtrados.map((caballo) => {
                const checked = seleccionados.has(caballo.id)
                return (
                  <label
                    key={caballo.id}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors select-none ${
                      checked ? 'bg-amber-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCaballo(caballo.id)}
                      className="h-4 w-4 rounded border-slate-300 accent-amber-500 cursor-pointer"
                    />
                    <span className="flex-1 text-sm text-slate-800">{caballo.nombre}</span>
                    {caballo.categoria && (
                      <span className="text-xs text-slate-400">{caballo.categoria}</span>
                    )}
                  </label>
                )
              })}
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          )}
        </div>

        {/* Pie */}
        <div className="px-5 py-4 border-t border-slate-200 flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={!puedeGuardar || guardando}
            className="flex-1 rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {guardando
              ? 'Guardando…'
              : `Crear ${filasValidas.length} alerta${filasValidas.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
