import { useEffect, useState } from 'react'
import { CreditCard, ExternalLink } from 'lucide-react'
import {
  suscripcionVetService,
  formatPrecio,
  formatPeriodo,
  type PlanSuscripcionVet,
  type SuscripcionVet,
} from '../../services/suscripcionVetService'
import { mensajeError } from '../../utils/error'

function formatFecha(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`
}

/**
 * Estado de la membresía del vet independiente, con la entrada al checkout.
 *
 * El otro punto de pago es el modal bloqueante del límite, pero ese solo
 * aparece cuando el vet ya se pasó del plan gratuito. Sin esta tarjeta, un vet
 * que quiere suscribirse antes de llegar al tope — o que quiere ver hasta
 * cuándo le corre lo que pagó — no tiene dónde hacerlo.
 */
export default function MembresiaVetCard() {
  const [suscripcion, setSuscripcion] = useState<SuscripcionVet | null>(null)
  const [plan,        setPlan]        = useState<PlanSuscripcionVet | null>(null)
  const [cargando,    setCargando]    = useState(true)
  const [pagando,     setPagando]     = useState(false)
  const [error,       setError]       = useState('')

  useEffect(() => {
    Promise.all([
      suscripcionVetService.miSuscripcion(),
      suscripcionVetService.planVigente(),
    ])
      .then(([s, p]) => { setSuscripcion(s); setPlan(p) })
      .catch((e) => setError(mensajeError(e, 'No se pudo cargar tu membresía.')))
      .finally(() => setCargando(false))
  }, [])

  async function pagar() {
    if (!plan || pagando) return
    setError('')
    setPagando(true)
    try {
      window.location.href = await suscripcionVetService.iniciarCheckout()
    } catch (e) {
      setError(mensajeError(e, 'No se pudo iniciar el pago.'))
      setPagando(false)
    }
  }

  // Un vet de haras no tiene fila de suscripción: para él la membresía no
  // significa nada y la tarjeta no debería aparecer.
  if (cargando || (!suscripcion && !error)) return null

  const vencimiento = suscripcion?.fecha_vencimiento
  const vigente = suscripcion?.estado === 'activa' &&
    (!vencimiento || new Date(vencimiento) > new Date())
  // Canceló pero le queda período pago: mismo criterio que `vet_suscripcion_activa`.
  const enPeriodoPago = suscripcion?.estado === 'cancelada' &&
    !!vencimiento && new Date(vencimiento) > new Date()

  const badge = vigente
    ? { texto: 'Activa',     clase: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    : enPeriodoPago
      ? { texto: 'Cancelada', clase: 'bg-amber-50 text-amber-700 border-amber-200' }
      : suscripcion?.estado === 'pendiente'
        ? { texto: 'Pago pendiente', clase: 'bg-amber-50 text-amber-700 border-amber-200' }
        : { texto: 'Plan gratuito', clase: 'bg-slate-100 text-slate-600 border-slate-200' }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <CreditCard size={15} className="text-slate-400" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Membresía
          </span>
        </div>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${badge.clase}`}>
          {badge.texto}
        </span>
      </div>

      <div className="px-4 py-4 space-y-3">
        {vigente && (
          <p className="text-sm text-slate-600">
            {vencimiento
              ? <>Se renueva el <strong className="text-slate-800">{formatFecha(vencimiento)}</strong>.</>
              : 'Sin fecha de vencimiento.'}
          </p>
        )}

        {enPeriodoPago && (
          <p className="text-sm text-slate-600">
            Cancelaste la renovación. Conservás el acceso hasta el{' '}
            <strong className="text-slate-800">{formatFecha(vencimiento)}</strong>.
          </p>
        )}

        {suscripcion?.estado === 'pendiente' && (
          <p className="text-sm text-slate-600">
            Empezaste a suscribirte pero MercadoPago todavía no confirmó el pago.
          </p>
        )}

        {!vigente && !enPeriodoPago && suscripcion?.estado !== 'pendiente' && (
          <p className="text-sm text-slate-600">
            Estás en el plan gratuito. Con la membresía cargás caballos propios sin tope.
          </p>
        )}

        {error && <p className="text-xs text-rose-600">{error}</p>}

        {!vigente && (
          <button
            onClick={pagar}
            disabled={!plan || pagando}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition
              hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            <ExternalLink size={15} />
            {pagando
              ? 'Abriendo MercadoPago…'
              : plan
                ? `Suscribirme — ${formatPrecio(plan)}/${formatPeriodo(plan)}`
                : 'Suscribirme — no disponible'}
          </button>
        )}

        {vigente && (
          <p className="text-xs text-slate-400">
            La renovación y la baja se gestionan desde tu cuenta de MercadoPago.
          </p>
        )}
      </div>
    </div>
  )
}
