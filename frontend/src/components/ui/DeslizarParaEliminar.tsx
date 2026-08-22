import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'

/**
 * Corre la fila hacia la izquierda con el dedo y deja a la vista un botón de
 * borrar, como el gesto de las listas del teléfono.
 *
 * Igual que el desliz del calendario, el gesto nunca llama a `preventDefault()`:
 * el scroll vertical de la página sigue siendo el nativo. Con `touch-action:
 * pan-y` el navegador se queda con lo vertical y nos deja lo horizontal, así que
 * bajar por el historial no abre ninguna fila.
 *
 * El gesto es solo táctil. Quien lo use tiene que dejar un botón visible para
 * mouse y teclado: con `pointer: fine` no hay dedo que deslizar.
 */

/** Ancho del panel rojo que queda a la vista con la fila corrida. */
const ANCHO_ACCION = 92

/** Recorrido a partir del cual el gesto es un desliz y no un toque o un scroll. */
const DESLIZ_MINIMO = 12

/** Ventana en la que un click se considera el coletazo del desliz recién soltado. */
const CLICK_FANTASMA_MS = 400

/** Eje del gesto en curso. Se decide en el primer tramo y no se vuelve a mirar. */
type Eje = 'indefinido' | 'horizontal' | 'vertical'

interface Gesto {
  x: number
  y: number
  /** Desplazamiento del que se parte: 0 si estaba cerrada, negativo si abierta. */
  base: number
  eje: Eje
}

interface Props {
  /** Qué hacer al tocar "Eliminar". Confirmar es cosa de quien lo pasa. */
  onEliminar: () => void
  /** Qué se está por borrar, para el lector de pantalla. */
  etiqueta: string
  children: React.ReactNode
}

export default function DeslizarParaEliminar({ onEliminar, etiqueta, children }: Props) {
  const [desplazado,  setDesplazado]  = useState(0)
  const [arrastrando, setArrastrando] = useState(false)
  const [abierto,     setAbierto]     = useState(false)

  const gesto = useRef<Gesto | null>(null)
  /** El desplazamiento al día: `desplazado` todavía no llegó dentro del handler. */
  const actual = useRef(0)
  /**
   * Cuándo se soltó el último desliz. El navegador manda un click después del
   * touchend y ese no cuenta: se descarta el que llega dentro de la ventana.
   * Va por tiempo y no por un booleano — si ese click nunca llega (el dedo
   * terminó sobre el botón de borrar, por ejemplo), la marca tiene que vencer
   * sola o se comería el toque siguiente, que sí es del usuario.
   */
  const finDesliz = useRef(0)

  function mover(px: number) {
    actual.current = px
    setDesplazado(px)
  }

  function cerrar() {
    mover(0)
    setAbierto(false)
  }

  function tocarInicio(e: React.TouchEvent) {
    const t = e.touches[0]
    gesto.current = { x: t.clientX, y: t.clientY, base: actual.current, eje: 'indefinido' }
    finDesliz.current = 0
  }

  function tocarMover(e: React.TouchEvent) {
    const g = gesto.current
    if (!g || g.eje === 'vertical') return
    const t  = e.touches[0]
    const dx = t.clientX - g.x
    const dy = t.clientY - g.y

    if (g.eje === 'indefinido') {
      // El dedo bajó: es scroll de la página y la fila no se mueve más.
      if (Math.abs(dy) > DESLIZ_MINIMO && Math.abs(dy) >= Math.abs(dx)) {
        g.eje = 'vertical'
        return
      }
      if (Math.abs(dx) > DESLIZ_MINIMO && Math.abs(dx) > Math.abs(dy)) {
        g.eje = 'horizontal'
        setArrastrando(true)
      } else {
        return
      }
    }

    // Solo hacia la izquierda, y nunca más allá del ancho del botón.
    mover(Math.min(0, Math.max(-ANCHO_ACCION, g.base + dx)))
  }

  function tocarFin() {
    const g = gesto.current
    gesto.current = null
    setArrastrando(false)
    if (g?.eje !== 'horizontal') return
    // Pasada la mitad del panel queda abierta; si no, vuelve sola.
    const abrir = actual.current < -ANCHO_ACCION / 2
    mover(abrir ? -ANCHO_ACCION : 0)
    setAbierto(abrir)
    finDesliz.current = Date.now()
  }

  function tocarCancelar() {
    gesto.current = null
    setArrastrando(false)
    mover(abierto ? -ANCHO_ACCION : 0)
  }

  /**
   * Con la fila corrida, tocarla la cierra en lugar de abrir la consulta; y el
   * click que el navegador manda al soltar un desliz no llega al contenido.
   */
  function tragarClick(e: React.MouseEvent) {
    // El botón de borrar viaja con la fila, así que sus clicks pasan por acá: son suyos.
    if ((e.target as HTMLElement).closest('[data-eliminar]')) return
    const fantasma = Date.now() - finDesliz.current < CLICK_FANTASMA_MS
    if (!abierto && !fantasma) return
    finDesliz.current = 0
    e.preventDefault()
    e.stopPropagation()
    if (abierto) cerrar()
  }

  return (
    // Sin `overflow-hidden` se verían la fila corrida saliéndose por la izquierda
    // y el botón esperando afuera, a la derecha.
    <div className="relative overflow-hidden rounded-xl">
      <div
        onTouchStart={tocarInicio}
        onTouchMove={tocarMover}
        onTouchEnd={tocarFin}
        onTouchCancel={tocarCancelar}
        onClickCapture={tragarClick}
        style={{
          transform: `translateX(${desplazado}px)`,
          // Con el dedo apoyado la fila sigue el movimiento; recién al soltar se acomoda sola.
          transition: arrastrando ? undefined : 'transform 160ms ease-out',
        }}
        className="relative touch-pan-y"
      >
        {children}
        {/*
          El botón va acá adentro, pegado al borde derecho y afuera del recorte,
          y entra empujado por el mismo desliz. Detrás de la fila no serviría: la
          fila tiene las esquinas redondeadas y el rojo se asomaría por los
          huecos de las curvas incluso con todo cerrado.
        */}
        <button
          type="button"
          data-eliminar
          onClick={() => { cerrar(); onEliminar() }}
          style={{ width: ANCHO_ACCION }}
          // Fuera del alcance del tabulador mientras no esté a la vista: para
          // teclado y mouse está el botón de siempre, adentro de la fila.
          tabIndex={abierto ? 0 : -1}
          aria-hidden={!abierto}
          className="absolute inset-y-0 left-full flex flex-col items-center justify-center gap-1 bg-red-600 text-white text-[11px] font-medium active:bg-red-700 transition-colors"
          aria-label={`Eliminar ${etiqueta}`}
        >
          <Trash2 size={16} />
          Eliminar
        </button>
      </div>
    </div>
  )
}
