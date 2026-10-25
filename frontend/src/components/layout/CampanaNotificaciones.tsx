import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { notificacionService, type Notificacion } from '../../services/notificacionService'

const ANCHO_PANEL = 320 // w-80
const MARGEN = 8

/**
 * Dónde poner el panel respecto de la campana, en coordenadas de la ventana.
 * - Con lugar a la derecha (la campana del sidebar de escritorio): al costado,
 *   alineado con la campana.
 * - Si no (el header de mobile, que ocupa todo el ancho): debajo de la campana,
 *   alineado a su borde derecho y sin salirse de la pantalla.
 */
function calcularPosicion(boton: DOMRect): { top: number; left: number } {
  const ancho = Math.min(ANCHO_PANEL, window.innerWidth - MARGEN * 2)
  if (window.innerWidth - boton.right - MARGEN >= ancho) {
    return { top: boton.top, left: boton.right + MARGEN }
  }
  const left = Math.min(boton.right - ancho, window.innerWidth - ancho - MARGEN)
  return { top: boton.bottom + 6, left: Math.max(MARGEN, left) }
}

/**
 * Campanita con las últimas notificaciones del usuario.
 *
 * Se refresca al montar y en cada cambio de ruta. No usa realtime a propósito:
 * lo que se notifica hoy son planes agendados para dentro de días, así que el
 * segundo exacto no aporta nada. Si en algún momento hace falta, alcanza con un
 * `supabase.channel()` sobre la tabla.
 */
export default function CampanaNotificaciones() {
  const navigate = useNavigate()
  const location = useLocation()

  const [items,   setItems]   = useState<Notificacion[]>([])
  const [abierto, setAbierto] = useState(false)
  const [pos,     setPos]     = useState<{ top: number; left: number } | null>(null)
  const botonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const cargar = useCallback(() => {
    notificacionService.listar().then(setItems).catch(() => {})
  }, [])

  useEffect(() => { cargar() }, [cargar, location.pathname])

  const posicionar = useCallback(() => {
    if (botonRef.current) setPos(calcularPosicion(botonRef.current.getBoundingClientRect()))
  }, [])

  // El panel se dibuja en un portal (ver abajo): hay que calcular dónde va antes de pintarlo
  // y recalcular si cambia el tamaño de la ventana.
  useLayoutEffect(() => {
    if (!abierto) return
    posicionar()
    window.addEventListener('resize', posicionar)
    return () => window.removeEventListener('resize', posicionar)
  }, [abierto, posicionar])

  // El panel vive fuera del botón (portal), así que "afuera" es afuera de los dos.
  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      const destino = e.target as Node
      if (botonRef.current?.contains(destino) || panelRef.current?.contains(destino)) return
      setAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto])

  const sinLeer = items.filter((n) => !n.leida).length

  async function abrir(n: Notificacion) {
    setAbierto(false)
    if (!n.leida) {
      setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, leida: true } : x))
      notificacionService.marcarLeida(n.id).catch(() => {})
    }
    if (n.link) navigate(n.link)
  }

  async function marcarTodas() {
    setItems((prev) => prev.map((x) => ({ ...x, leida: true })))
    notificacionService.marcarTodasLeidas().catch(() => {})
  }

  return (
    <>
      <button
        ref={botonRef}
        onClick={() => setAbierto((v) => !v)}
        className="relative p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
        aria-label={sinLeer > 0 ? `${sinLeer} notificaciones sin leer` : 'Notificaciones'}
      >
        <Bell size={18} />
        {sinLeer > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white">
            {sinLeer > 9 ? '9+' : sinLeer}
          </span>
        )}
      </button>

      {/* El panel va en un portal, con `position: fixed` calculado desde la campana.
          Adentro del sidebar no se puede: el <aside> tiene `overflow-hidden` (lo
          necesita para las esquinas redondeadas) y recortaba el panel, de 320px, en
          el borde del sidebar, de 256px. Anclarlo con left/right no lo arregla. */}
      {abierto && pos && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notificaciones"
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-[60] w-80 max-w-[calc(100vw-1rem)] rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-xs font-semibold text-slate-600">Notificaciones</span>
            {sinLeer > 0 && (
              <button onClick={marcarTodas} className="text-[11px] text-brand-600 hover:text-brand-700">
                Marcar todas como leídas
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-slate-400">Sin notificaciones.</p>
            ) : items.map((n) => (
              <button
                key={n.id}
                onClick={() => abrir(n)}
                className={`block w-full px-3 py-2.5 text-left transition-colors hover:bg-slate-50 ${
                  n.leida ? '' : 'bg-brand-50/40'
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.leida && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />}
                  <div className={n.leida ? 'pl-3.5' : ''}>
                    <p className="text-xs font-medium text-slate-800">{n.titulo}</p>
                    {n.cuerpo && <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{n.cuerpo}</p>}
                    <p className="mt-1 text-[10px] text-slate-400">
                      {new Date(n.created_at).toLocaleDateString('es-AR', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
