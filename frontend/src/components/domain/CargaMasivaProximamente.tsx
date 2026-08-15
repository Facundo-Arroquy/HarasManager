import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Mail, MessageCircle, Upload } from 'lucide-react'
import { WHATSAPP_CONTACTO, mailtoSoporte, whatsappLink } from '../../utils/contacto'

/** Mismo texto para los dos canales, así la consulta llega igual por donde venga. */
const CONSULTA =
  'Hola, quiero cargar mis caballos de forma masiva. Les paso el listado para que lo suban.'

/** Ancho ideal del cartel; en mobile se recorta al viewport. */
const ANCHO   = 288
/** Margen mínimo contra los bordes de la pantalla. */
const MARGEN  = 12
/** Gracia para mover el mouse del botón al cartel sin que se cierre. */
const CIERRE_MS = 120

/**
 * Botón "próximamente" de carga masiva de caballos.
 *
 * Todavía no existe la importación por Excel para el veterinario (hoy es solo
 * para admin), pero el vet que llega con 80 caballos necesita saber que no los
 * tiene que cargar de a uno: nos escribe y los cargamos nosotros.
 *
 * No dispara ninguna acción — al pasar el mouse (desktop) o tocarlo (mobile)
 * abre un cartel con el mail de soporte.
 */
export default function CargaMasivaProximamente() {
  const [abierto, setAbierto] = useState(false)
  const [coords,  setCoords]  = useState({ top: 0, left: 0, ancho: ANCHO })

  const btnRef     = useRef<HTMLButtonElement>(null)
  const cartelRef  = useRef<HTMLDivElement>(null)
  const timerRef   = useRef<number | null>(null)

  const cancelarCierre = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const cerrar = useCallback(() => {
    cancelarCierre()
    setAbierto(false)
  }, [cancelarCierre])

  /** Cierre diferido, para que se pueda pasar del botón al cartel. */
  const cerrarConGracia = useCallback(() => {
    cancelarCierre()
    timerRef.current = window.setTimeout(() => setAbierto(false), CIERRE_MS)
  }, [cancelarCierre])

  /**
   * Ancla el cartel debajo del botón, alineado a su borde derecho y siempre
   * dentro de la pantalla — en mobile el botón queda pegado al borde y el
   * cartel se saldría del viewport.
   */
  const ubicar = useCallback(() => {
    if (!btnRef.current) return
    const r     = btnRef.current.getBoundingClientRect()
    const ancho = Math.min(ANCHO, window.innerWidth - MARGEN * 2)
    const left  = Math.min(
      Math.max(r.right - ancho, MARGEN),
      window.innerWidth - ancho - MARGEN,
    )
    setCoords({ top: r.bottom + 8, left, ancho })
  }, [])

  const abrir = useCallback(() => {
    cancelarCierre()
    ubicar()
    setAbierto(true)
  }, [cancelarCierre, ubicar])

  // Cierre por click afuera, Escape o scroll (el cartel es `fixed` y se
  // despegaría del botón).
  useEffect(() => {
    if (!abierto) return

    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || cartelRef.current?.contains(t)) return
      cerrar()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') cerrar()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', cerrar, true)
    window.addEventListener('resize', cerrar)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', cerrar, true)
      window.removeEventListener('resize', cerrar)
    }
  }, [abierto, cerrar])

  useEffect(() => cancelarCierre, [cancelarCierre])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        onClick={() => (abierto ? cerrar() : abrir())}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') abrir() }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') cerrarConGracia() }}
        onFocus={abrir}
        onBlur={cerrarConGracia}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 py-2 text-sm font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors"
      >
        <Upload size={15} className="shrink-0" />
        <span className="hidden sm:inline">Carga masiva</span>
        {/* En mobile el header comparte ancho con el título: la píldora larga lo
            hacía wrapear, así que ahí va abreviada. */}
        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 leading-none">
          <span className="sm:hidden">Pronto</span>
          <span className="hidden sm:inline">Próximamente</span>
        </span>
      </button>

      {abierto && createPortal(
        <div
          ref={cartelRef}
          role="dialog"
          aria-label="Carga masiva de caballos"
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            width: coords.ancho,
            zIndex: 9999,
          }}
          onPointerEnter={(e) => { if (e.pointerType === 'mouse') cancelarCierre() }}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') cerrarConGracia() }}
          className="rounded-lg border border-slate-200 bg-white p-3 shadow-xl"
        >
          <p className="text-xs font-semibold text-slate-900">
            Carga masiva de caballos
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Estamos preparando la importación para cargar todos tus caballos de una
            sola vez. Mientras tanto, escribinos y los cargamos por vos.
          </p>
          {/* El ícono solo no alcanza para que se entienda que los dos botones
              oscuros son WhatsApp y no dos acciones distintas. */}
          <p className="mt-2.5 mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <MessageCircle size={11} className="shrink-0" />
            WhatsApp
          </p>
          <div className="flex items-center gap-2">
            {WHATSAPP_CONTACTO.map((c) => (
              <a
                key={c.numero}
                href={whatsappLink(c.numero, CONSULTA)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={cerrar}
                className="flex flex-1 items-center justify-center rounded-lg bg-slate-900 px-2.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                {c.nombre}
              </a>
            ))}
          </div>
          <a
            href={mailtoSoporte('Carga masiva de caballos', CONSULTA)}
            onClick={cerrar}
            className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400 transition-colors"
          >
            <Mail size={14} className="shrink-0" />
            Email
          </a>
        </div>,
        document.body,
      )}
    </>
  )
}
