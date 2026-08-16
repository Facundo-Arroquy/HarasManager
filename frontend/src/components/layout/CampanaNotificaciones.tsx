import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { notificacionService, type Notificacion } from '../../services/notificacionService'

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
  const ref = useRef<HTMLDivElement>(null)

  const cargar = useCallback(() => {
    notificacionService.listar().then(setItems).catch(() => {})
  }, [])

  useEffect(() => { cargar() }, [cargar, location.pathname])

  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
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
    <div className="relative" ref={ref}>
      <button
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

      {/* En mobile la campana está en un header de ancho completo y el panel abre
          hacia la izquierda. En desktop vive en el sidebar (w-60 = 240px), que es
          más angosto que el panel (w-80 = 320px): anclado a la derecha se salía
          ~100px por el borde izquierdo de la pantalla y el `overflow-hidden` del
          layout lo recortaba. En md+ abre hacia el contenido. */}
      {abierto && (
        <div className="absolute right-0 md:right-auto md:left-0 z-50 mt-1.5 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white shadow-lg">
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
        </div>
      )}
    </div>
  )
}
