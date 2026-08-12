import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, CreditCard, Check, Stethoscope } from 'lucide-react'
import { vetLimiteService, type EstadoLimiteVet, type CaballoPropioVet } from '../../services/vetLimiteService'
import {
  suscripcionVetService,
  formatPrecio,
  formatPeriodo,
  type PlanSuscripcionVet,
} from '../../services/suscripcionVetService'
import { mensajeError } from '../../utils/error'
import Spinner from '../ui/Spinner'

interface Props {
  estado: EstadoLimiteVet
  /** Se llama tras dar de baja con éxito, para revalidar el estado del límite. */
  onResuelto: () => void
}

function formatFecha(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`
}

/**
 * Modal bloqueante de regularización del plan gratuito.
 *
 * Aparece cuando un vet quedó con más caballos propios de los que permite el
 * plan gratuito y su suscripción ya no está vigente — el caso típico es el vet
 * que pagó un mes, cargó 50 caballos y dejó de pagar. Hasta ahora el límite
 * solo se miraba al crear, así que ese vet se quedaba con los 50 para siempre.
 *
 * No se puede cerrar a propósito: las únicas salidas son dar de baja caballos
 * hasta volver al límite, o retomar la membresía pagando con MercadoPago.
 */
export default function LimiteCaballosVetModal({ estado, onResuelto }: Props) {
  const [caballos,     setCaballos]     = useState<CaballoPropioVet[]>([])
  const [seleccion,    setSeleccion]    = useState<Set<string>>(new Set())
  const [cargando,     setCargando]     = useState(true)
  const [procesando,   setProcesando]   = useState(false)
  const [confirmando,  setConfirmando]  = useState(false)
  const [error,        setError]        = useState('')
  const [plan,         setPlan]         = useState<PlanSuscripcionVet | null>(null)
  const [pagando,      setPagando]      = useState(false)

  useEffect(() => {
    vetLimiteService.listarPropios()
      .then(setCaballos)
      .catch((e) => setError(mensajeError(e, 'No se pudieron cargar tus caballos.')))
      .finally(() => setCargando(false))
  }, [])

  // El precio se lee de la base. Si falla, la salida por pago queda
  // deshabilitada y el vet todavía puede regularizar dando de baja.
  useEffect(() => {
    suscripcionVetService.planVigente()
      .then(setPlan)
      .catch(() => setPlan(null))
  }, [])

  const restantes    = caballos.length - seleccion.size
  const aunSobran    = Math.max(restantes - estado.limite, 0)
  const puedeAplicar = restantes <= estado.limite && seleccion.size > 0

  // Los que más consultas tienen son los que más duele perder: se ordenan al
  // final para que la elección por descarte sea la menos destructiva.
  const ordenados = useMemo(
    () => [...caballos].sort((a, b) => a.consultas - b.consultas),
    [caballos]
  )

  function toggle(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function pagar() {
    if (!plan || pagando) return
    setError('')
    setPagando(true)
    try {
      const initPoint = await suscripcionVetService.iniciarCheckout()
      // Redirect completo y no popup: el checkout de MercadoPago vuelve por
      // `back_url`, y un popup bloqueado dejaría al vet sin ninguna salida.
      window.location.href = initPoint
    } catch (e) {
      setError(mensajeError(e, 'No se pudo iniciar el pago.'))
      setPagando(false)
    }
  }

  async function aplicar() {
    if (!puedeAplicar || procesando) return
    setError('')
    setProcesando(true)
    try {
      await vetLimiteService.darDeBajaLote([...seleccion])
      onResuelto()
    } catch (e) {
      setError(mensajeError(e, 'No se pudieron dar de baja los caballos.'))
      setProcesando(false)
      setConfirmando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl flex flex-col max-h-[90vh]">

        {/* ── Cabecera ── */}
        <div className="px-6 pt-6 pb-4 border-b border-zinc-800">
          {confirmando ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setConfirmando(false)}
                disabled={procesando}
                className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 -ml-1 rounded-md disabled:opacity-40"
              >
                <ArrowLeft size={16} />
              </button>
              <h2 className="text-sm font-bold text-zinc-100">Confirmar bajas</h2>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30">
                <AlertTriangle size={18} className="text-amber-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-zinc-100">
                  {estado.suscripcion_activa
                    ? 'Superaste el límite de tu membresía'
                    : 'Superaste tu plan gratuito'}
                </h2>
                <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                  Tenés <strong className="text-zinc-200">{estado.caballos_propios} caballos propios</strong>
                  {estado.suscripcion_activa
                    ? <> y tu membresía incluye hasta <strong className="text-zinc-200">{estado.limite}</strong>.</>
                    : <> y tu membresía no está activa. El plan gratuito incluye hasta{' '}
                        <strong className="text-zinc-200">{estado.limite}</strong>.</>}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Vista de confirmación ── */}
        {confirmando ? (
          <div className="px-6 py-6 space-y-4">
            <p className="text-sm text-zinc-300 leading-relaxed">
              Vas a dar de baja <strong className="text-zinc-100">{seleccion.size}</strong>{' '}
              {seleccion.size === 1 ? 'caballo' : 'caballos'}. Van a desaparecer de tu panel y
              de tus alertas.
            </p>
            <p className="text-xs text-zinc-500 leading-relaxed">
              No se borra nada: el historial clínico, la sanidad y el pedigree quedan guardados.
              Los vas a encontrar en <strong className="text-zinc-400">Dados de baja</strong>, en tu
              panel, y podés reactivarlos cuando tengas cupo o membresía activa.
            </p>

            {error && <p className="text-xs text-rose-400">{error}</p>}

            <button
              onClick={aplicar}
              disabled={procesando}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white transition
                hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {procesando
                ? 'Dando de baja…'
                : <>
                    <Check size={15} />
                    Confirmar {seleccion.size} {seleccion.size === 1 ? 'baja' : 'bajas'}
                  </>}
            </button>
          </div>
        ) : (
          <>
            {/* ── Contador ── */}
            <div className="px-6 py-3 border-b border-zinc-800 flex items-center justify-between gap-3">
              <span className="text-xs text-zinc-500">
                Seleccionados: <strong className="text-zinc-300">{seleccion.size}</strong>
              </span>
              <span className={`text-xs font-medium ${aunSobran > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {aunSobran > 0
                  ? `Falta dar de baja ${aunSobran} más`
                  : `Te quedan ${restantes} de ${estado.limite}`}
              </span>
            </div>

            {/* ── Lista ── */}
            <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
              {cargando ? (
                <div className="flex justify-center py-12"><Spinner size="lg" /></div>
              ) : error && caballos.length === 0 ? (
                <p className="px-6 py-10 text-sm text-rose-400 text-center">{error}</p>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {ordenados.map((c) => {
                    const marcado = seleccion.has(c.id)
                    return (
                      <label
                        key={c.id}
                        className={`flex items-start gap-3 px-6 py-3 cursor-pointer transition-colors ${
                          marcado ? 'bg-amber-500/10' : 'hover:bg-zinc-800/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() => toggle(c.id)}
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500/50"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-zinc-100 truncate">{c.nombre}</p>
                          <p className="text-[11px] text-zinc-500 truncate">
                            {[c.categoria, c.raza_nombre].filter(Boolean).join(' · ') || 'Sin datos'}
                            {' · alta '}{formatFecha(c.created_at)}
                          </p>
                        </div>
                        {c.consultas > 0 && (
                          <span className="flex items-center gap-1 shrink-0 text-[10px] text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-full px-2 py-0.5">
                            <Stethoscope size={10} />
                            {c.consultas}
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── Pie ── */}
            <div className="px-6 py-4 border-t border-zinc-800 space-y-2">
              {error && caballos.length > 0 && (
                <p className="text-xs text-rose-400 text-center">{error}</p>
              )}

              <button
                onClick={() => { setError(''); setConfirmando(true) }}
                disabled={!puedeAplicar}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white transition
                  hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                Dar de baja {seleccion.size > 0 ? `(${seleccion.size})` : ''}
              </button>

              {/* Pagar solo es una salida si todavía no paga. Al vet que ya
                  tiene membresía y se pasó de los 25, ofrecerle "retomar
                  membresía" sería venderle lo que ya compró. */}
              {estado.suscripcion_activa ? (
                <p className="text-center text-[10px] text-zinc-600 pt-1">
                  Tu membresía ya está activa: el tope de {estado.limite} es el máximo del plan.
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-3 py-0.5">
                    <div className="h-px flex-1 bg-zinc-800" />
                    <span className="text-[10px] uppercase tracking-wide text-zinc-600">o</span>
                    <div className="h-px flex-1 bg-zinc-800" />
                  </div>

                  <button
                    onClick={pagar}
                    disabled={!plan || pagando}
                    className="w-full flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 py-2.5 text-sm font-semibold text-zinc-200 transition
                      hover:bg-zinc-700 hover:border-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                  >
                    <CreditCard size={15} />
                    {pagando
                      ? 'Abriendo MercadoPago…'
                      : plan
                        ? `Retomar membresía — ${formatPrecio(plan)}/${formatPeriodo(plan)}`
                        : 'Retomar membresía — no disponible'}
                  </button>

                  <p className="text-center text-[10px] text-zinc-600 pt-1">
                    Con la membresía activa llegás hasta {estado.limite_con_membresia} caballos.
                  </p>
                </>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  )
}
