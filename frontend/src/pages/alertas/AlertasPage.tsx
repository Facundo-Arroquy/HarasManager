import { useEffect, useState } from 'react'
import { Bell, Plus, Trash2 } from 'lucide-react'
import { alertaService, type Alerta } from '../../services/alertaService'
import { caballoService } from '../../services/caballoService'
import { useAuthStore } from '../../store/authStore'
import NuevaAlertaModal from '../../components/domain/NuevaAlertaModal'
import Spinner from '../../components/ui/Spinner'

type EstadoAlerta = 'vencida' | 'hoy' | 'proxima' | 'futura'

function getEstado(fechaAlerta: string): EstadoAlerta {
  const hoy   = new Date(); hoy.setHours(0, 0, 0, 0)
  const fecha = new Date(fechaAlerta + 'T00:00:00')
  const diff  = Math.round((fecha.getTime() - hoy.getTime()) / 86400000)
  if (diff < 0)  return 'vencida'
  if (diff === 0) return 'hoy'
  if (diff <= 7)  return 'proxima'
  return 'futura'
}

function diasRestantes(fechaAlerta: string): number {
  const hoy   = new Date(); hoy.setHours(0, 0, 0, 0)
  const fecha = new Date(fechaAlerta + 'T00:00:00')
  return Math.round((fecha.getTime() - hoy.getTime()) / 86400000)
}

function BadgeEstado({ fecha }: { fecha: string }) {
  const estado = getEstado(fecha)
  const dias   = diasRestantes(fecha)

  const cfg: Record<EstadoAlerta, { label: string; cls: string }> = {
    vencida: { label: 'Vencida',         cls: 'bg-red-100 text-red-700 border-red-200' },
    hoy:     { label: 'Hoy',             cls: 'bg-orange-100 text-orange-700 border-orange-200' },
    proxima: { label: `En ${dias} día${dias !== 1 ? 's' : ''}`, cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    futura:  { label: `En ${dias} días`,  cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  }

  const { label, cls } = cfg[estado]
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  )
}

function formatFecha(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function AlertasPage() {
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const userId     = useAuthStore((s) => s.user?.id)
  const rol        = useAuthStore((s) => s.rol)

  const [alertas,    setAlertas]    = useState<Alerta[]>([])
  const [caballos,   setCaballos]   = useState<{ id: string; nombre: string; categoria?: string }[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [showModal,  setShowModal]  = useState(false)
  const [eliminando, setEliminando] = useState<string | null>(null)

  const esVet      = rol === 'veterinario'
  const puedeCrear = rol === 'admin' || rol === 'jugador' || rol === 'piloto' || esVet

  async function cargar() {
    if (!userId) return
    if (!esVet && !sociedadId) return
    setLoading(true)
    setError(null)
    try {
      const [a, c] = await Promise.all([
        alertaService.listar({ sociedadId, userId, esVet }),
        esVet
          ? caballoService.listarDelVeterinario(userId)
          : caballoService.listar(sociedadId!),
      ])
      setAlertas(a)
      setCaballos(c.map((cab: any) => ({ id: cab.id, nombre: cab.nombre, categoria: cab.categoria })))
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : 'Error al cargar alertas.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [sociedadId, userId, esVet]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleEliminar(id: string) {
    setEliminando(id)
    try {
      await alertaService.eliminar(id)
      setAlertas((prev) => prev.filter((a) => a.id !== id))
    } finally {
      setEliminando(null)
    }
  }

  // Separar por estado para mostrar secciones
  const vencidas = alertas.filter((a) => getEstado(a.fecha_alerta) === 'vencida')
  const activas  = alertas.filter((a) => getEstado(a.fecha_alerta) !== 'vencida')

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto pb-16">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Alertas</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            {loading ? '…' : `${alertas.length} alerta${alertas.length !== 1 ? 's' : ''} activa${alertas.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {puedeCrear && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 px-3 py-2 text-sm font-medium text-white transition-colors"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Nueva alerta</span>
          </button>
        )}
      </div>

      {loading && <div className="flex justify-center py-20"><Spinner size="lg" /></div>}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Error: {error}
        </div>
      )}

      {!loading && !error && alertas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <Bell size={36} strokeWidth={1.2} />
          <p className="text-sm">No hay alertas configuradas</p>
          {puedeCrear && (
            <button
              onClick={() => setShowModal(true)}
              className="mt-1 text-sm text-amber-600 hover:text-amber-700 font-medium"
            >
              Crear primera alerta →
            </button>
          )}
        </div>
      )}

      {!loading && !error && alertas.length > 0 && (
        <div className="space-y-8">

          {/* Alertas próximas/activas */}
          {activas.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 px-1">
                Próximas
              </h2>
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
                {activas.map((alerta) => (
                  <AlertaRow
                    key={alerta.id}
                    alerta={alerta}
                    onEliminar={handleEliminar}
                    eliminando={eliminando === alerta.id}
                    puedeEliminar={puedeCrear}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Alertas vencidas */}
          {vencidas.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-red-400 px-1">
                Vencidas
              </h2>
              <div className="rounded-xl border border-red-100 bg-white overflow-hidden divide-y divide-slate-100">
                {vencidas.map((alerta) => (
                  <AlertaRow
                    key={alerta.id}
                    alerta={alerta}
                    onEliminar={handleEliminar}
                    eliminando={eliminando === alerta.id}
                    puedeEliminar={puedeCrear}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {showModal && (
        <NuevaAlertaModal
          caballos={caballos}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); cargar() }}
        />
      )}
    </div>
  )
}

// ── Fila de alerta ────────────────────────────────────────────────────────────

interface AlertaRowProps {
  alerta: Alerta
  onEliminar: (id: string) => void
  eliminando: boolean
  puedeEliminar: boolean
}

function AlertaRow({ alerta, onEliminar, eliminando, puedeEliminar }: AlertaRowProps) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 mt-0.5">
        <Bell size={15} className="text-amber-500" />
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Motivo + badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800">{alerta.motivo}</span>
          <BadgeEstado fecha={alerta.fecha_alerta} />
        </div>

        {/* Fecha */}
        <p className="text-xs text-slate-400">{formatFecha(alerta.fecha_alerta)}</p>

        {/* Caballos */}
        {alerta.caballos.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            {alerta.caballos.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 font-medium"
              >
                {c.nombre}
              </span>
            ))}
          </div>
        )}
      </div>

      {puedeEliminar && (
        <button
          onClick={() => onEliminar(alerta.id)}
          disabled={eliminando}
          className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
          title="Eliminar alerta"
        >
          {eliminando ? <Spinner size="sm" /> : <Trash2 size={15} />}
        </button>
      )}
    </div>
  )
}
