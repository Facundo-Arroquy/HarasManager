import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { suscripcionVetService, type EstadoSuscripcion } from '../../services/suscripcionVetService'
import { useAuth } from '../../hooks/useAuth'
import Spinner from '../../components/ui/Spinner'
import logoUrl from '../../assets/logo.png'

/** Cada cuánto se re-consulta el estado, y cuántas veces antes de rendirse. */
const INTERVALO_MS = 2500
const INTENTOS_MAX = 12

type Resultado = 'verificando' | 'activa' | 'demorada' | 'error'

/**
 * Pantalla de vuelta del checkout de MercadoPago (`back_url` del preapproval).
 *
 * MercadoPago devuelve al vet apenas termina de cargar el medio de pago, pero
 * la que activa la membresía es la notificación del webhook, que puede llegar
 * unos segundos después. Por eso acá se consulta el estado en intervalos en
 * vez de dar por hecho que volver del checkout significa "pagado".
 *
 * Vive fuera de `RequireAuth` a propósito: ese guard monta el modal bloqueante
 * del límite, y un vet que acaba de pagar quedaría atrapado detrás de él
 * justamente mientras esperamos la confirmación que lo libera.
 */
export default function SuscripcionResultadoPage() {
  const navigate = useNavigate()
  const { isAuthenticated, loading } = useAuth()

  const [resultado, setResultado] = useState<Resultado>('verificando')
  const intentos = useRef(0)

  const consultar = useCallback(async (): Promise<EstadoSuscripcion | null> => {
    const suscripcion = await suscripcionVetService.miSuscripcion()
    return suscripcion?.estado ?? null
  }, [])

  useEffect(() => {
    if (loading || !isAuthenticated) return

    let cancelado = false
    let timer: ReturnType<typeof setTimeout>

    async function verificar() {
      try {
        const estado = await consultar()
        if (cancelado) return

        if (estado === 'activa') {
          setResultado('activa')
          return
        }

        intentos.current += 1
        if (intentos.current >= INTENTOS_MAX) {
          setResultado('demorada')
          return
        }
        timer = setTimeout(verificar, INTERVALO_MS)
      } catch {
        if (!cancelado) setResultado('error')
      }
    }

    verificar()
    return () => { cancelado = true; clearTimeout(timer) }
  }, [loading, isAuthenticated, consultar])

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate('/login', { replace: true })
  }, [loading, isAuthenticated, navigate])

  const contenido = {
    verificando: {
      icono: <Spinner size="lg" />,
      titulo: 'Confirmando tu pago',
      texto: 'Estamos esperando la confirmación de MercadoPago. No cierres esta pantalla.',
    },
    activa: {
      icono: <CheckCircle2 size={40} className="text-emerald-400" />,
      titulo: 'Membresía activa',
      texto: 'Ya podés cargar todos los caballos que necesites. Gracias.',
    },
    demorada: {
      icono: <Clock size={40} className="text-amber-400" />,
      titulo: 'El pago está procesándose',
      texto: 'MercadoPago todavía no nos confirmó la operación. Suele tardar unos minutos: ' +
        'volvé a entrar más tarde y, si el cobro salió, la membresía va a estar activa.',
    },
    error: {
      icono: <XCircle size={40} className="text-rose-400" />,
      titulo: 'No pudimos verificar el estado',
      texto: 'Hubo un problema al consultar tu membresía. Si el pago se hizo, se va a acreditar igual.',
    },
  }[resultado]

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-4">
      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/85 p-10 shadow-2xl backdrop-blur-md">

          <div className="mb-8 flex flex-col items-center gap-4">
            <img src={logoUrl} alt="" className="h-12 w-auto" />
          </div>

          <div className="flex flex-col items-center gap-4 text-center">
            {contenido.icono}
            <h1 className="text-lg font-bold text-zinc-100">{contenido.titulo}</h1>
            <p className="text-sm leading-relaxed text-zinc-400">{contenido.texto}</p>

            {resultado !== 'verificando' && (
              <button
                onClick={() => navigate('/panel-vet', { replace: true })}
                className="mt-2 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition
                  hover:bg-brand-500 active:scale-[0.98]"
              >
                Ir a mi panel
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
