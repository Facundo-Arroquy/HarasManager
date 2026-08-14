import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Syringe, Check, X, CheckCircle2, CalendarDays } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { sanidadService } from '../../services/sanidadService'
import { nombreCaballo } from '../../utils/caballo'
import { mensajeError } from '../../utils/error'
import { LABEL_ESTADO_TRABAJO, type TrabajoSanitario } from '../../types/sanidad'
import NuevoTrabajoSanitarioModal from '../../components/domain/NuevoTrabajoSanitarioModal'
import NuevaConsultaModal from '../../components/domain/NuevaConsultaModal'
import Spinner from '../../components/ui/Spinner'

const ESTADO_BADGE: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  realizado: 'bg-emerald-100 text-emerald-700',
  cancelado: 'bg-slate-100 text-slate-500',
}

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

export default function SanidadPage() {
  const sociedadId = useAuthStore((s) => s.sociedadActiva?.id)
  const rol        = useAuthStore((s) => s.rol)
  const esVet      = rol === 'veterinario'

  const [trabajos, setTrabajos] = useState<TrabajoSanitario[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [showNuevo, setShowNuevo] = useState(false)
  const [showConsulta, setShowConsulta] = useState(false)
  const [completar, setCompletar] = useState<TrabajoSanitario | null>(null)

  const cargar = useCallback(async () => {
    if (!esVet && !sociedadId) return
    setLoading(true)
    setError(null)
    try {
      setTrabajos(esVet
        ? await sanidadService.listarTrabajosVet()
        : await sanidadService.listarTrabajos(sociedadId!))
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setLoading(false)
    }
  }, [sociedadId, esVet])

  useEffect(() => { cargar() }, [cargar])

  const pendientes = useMemo(() => trabajos.filter((t) => t.estado === 'pendiente'), [trabajos])
  const historial  = useMemo(() => trabajos.filter((t) => t.estado !== 'pendiente'), [trabajos])

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Sanidad</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Trabajos sanitarios (vacunas, desparasitaciones, etc.)
          </p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {esVet && (
            <button
              onClick={() => setShowConsulta(true)}
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 px-3 py-2 text-sm font-medium text-white transition-colors"
            >
              <Plus size={15} />
              <span className="sm:hidden">Consulta</span>
              <span className="hidden sm:inline">Nueva consulta</span>
            </button>
          )}
          <button
            onClick={() => setShowNuevo(true)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              esVet
                ? 'border border-slate-300 hover:border-slate-400 text-slate-700'
                : 'bg-brand-500 hover:bg-brand-400 text-white'
            }`}
          >
            <Plus size={15} />
            <span className="sm:hidden">Plan</span>
            <span className="hidden sm:inline">Nuevo plan sanitario</span>
          </button>
        </div>
      </div>

      {loading && <div className="flex justify-center py-20"><Spinner size="lg" /></div>}
      {error   && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">Error: {error}</div>}

      {!loading && !error && trabajos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-sm">
          <Syringe size={28} className="mb-2 opacity-30" />
          Sin trabajos sanitarios. Creá el primero con “Nuevo plan sanitario”.
        </div>
      )}

      {!loading && !error && trabajos.length > 0 && (
        <div className="space-y-6">
          {pendientes.length > 0 && (
            <Seccion titulo="Pendientes">
              {pendientes.map((t) => (
                <TrabajoRow key={t.id} trabajo={t} onCompletar={() => setCompletar(t)} />
              ))}
            </Seccion>
          )}
          {historial.length > 0 && (
            <Seccion titulo="Realizados / cancelados">
              {historial.map((t) => <TrabajoRow key={t.id} trabajo={t} />)}
            </Seccion>
          )}
        </div>
      )}

      {showNuevo && (
        <NuevoTrabajoSanitarioModal
          onClose={() => setShowNuevo(false)}
          onSuccess={() => { setShowNuevo(false); cargar() }}
        />
      )}
      {showConsulta && (
        <NuevaConsultaModal
          onClose={() => setShowConsulta(false)}
          onSuccess={() => setShowConsulta(false)}
        />
      )}
      {completar && (
        <CompletarModal
          trabajo={completar}
          onClose={() => setCompletar(null)}
          onSuccess={() => { setCompletar(null); cargar() }}
        />
      )}
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-600 mb-1.5">{titulo}</h2>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-200">
        {children}
      </div>
    </section>
  )
}

function TrabajoRow({ trabajo, onCompletar }: { trabajo: TrabajoSanitario; onCompletar?: () => void }) {
  const total     = trabajo.caballos?.length ?? 0
  const incluidos = trabajo.caballos?.filter((c) => !c.excluido).length ?? total
  return (
    <div className="flex items-start gap-3 px-4 py-3 text-sm">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-slate-900">{trabajo.nombre}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ESTADO_BADGE[trabajo.estado]}`}>
            {LABEL_ESTADO_TRABAJO[trabajo.estado]}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-slate-400">
          <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {formatFecha(trabajo.fecha_programada)}</span>
          <span>{trabajo.estado === 'realizado' ? `${incluidos} caballo${incluidos !== 1 ? 's' : ''}` : `${total} caballo${total !== 1 ? 's' : ''}`}</span>
          {trabajo.tratamiento && <span>· {trabajo.tratamiento}</span>}
        </div>
        {trabajo.observaciones && <p className="text-xs text-slate-400 mt-1">{trabajo.observaciones}</p>}
      </div>
      {onCompletar && (
        <button
          onClick={onCompletar}
          className="shrink-0 flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1.5 text-xs font-medium text-white transition-colors"
        >
          <Check size={13} /> Realizado
        </button>
      )}
    </div>
  )
}

// ── Modal: marcar realizado (con exclusión) ──────────────────────────────────
function CompletarModal({
  trabajo, onClose, onSuccess,
}: {
  trabajo: TrabajoSanitario
  onClose: () => void
  onSuccess: () => void
}) {
  const caballos = trabajo.caballos ?? []
  // incluidos = los que reciben el trabajo. Arrancan todos incluidos.
  const [incluidos, setIncluidos] = useState<Set<string>>(
    () => new Set(caballos.filter((c) => !c.excluido).map((c) => c.id)),
  )
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function toggle(id: string) {
    setIncluidos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function confirmar() {
    setError('')
    if (incluidos.size === 0) return setError('Seleccioná al menos un caballo, o cancelá.')
    setSaving(true)
    try {
      const excluidoRowIds = caballos.filter((c) => !incluidos.has(c.id)).map((c) => c.id)
      await sanidadService.completarTrabajo(trabajo.id, excluidoRowIds)
      onSuccess()
    } catch (e) {
      setError(mensajeError(e, 'Error al completar.'))
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md sm:mx-4 rounded-t-2xl sm:rounded-xl border border-slate-300 bg-white shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Marcar realizado</h2>
              <p className="text-xs text-slate-500 mt-0.5">{trabajo.nombre}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          <p className="text-xs text-slate-500">
            Se cargará en el historial de los caballos marcados. Destildá los que no
            corresponda (quedan excluidos).
          </p>
          <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
            {caballos.map((c) => (
              <label key={c.id} className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={incluidos.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-slate-700">
                  {c.caballo ? nombreCaballo(c.caballo) : c.caballo_id}
                </span>
              </label>
            ))}
          </div>
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600">
              <X size={13} /> {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando…' : `Realizar (${incluidos.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}
