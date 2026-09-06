import { useNavigate } from 'react-router-dom'
import type { KeyboardEvent, MouseEvent } from 'react'

interface Props {
  /** UUID del caballo. Sin id no hay perfil al que ir y se muestra texto plano. */
  id?: string | null
  nombre?: string | null
  /** Clases del texto (color, peso, truncado). El subrayado lo pone el componente. */
  className?: string
  /** Qué mostrar cuando no hay nombre. */
  fallback?: string
}

/**
 * Nombre de un caballo que lleva a su perfil (`/caballos/:id/historial`).
 *
 * Se renderiza como `<span role="link">` y no como `<a>` a propósito: casi
 * todos los lugares donde aparece un nombre ya están dentro de un `<button>` o
 * de una fila clickeable, y anidar un `<a>` ahí es HTML inválido. El click
 * frena la propagación para que tocar el nombre vaya al perfil y no dispare la
 * acción de la fila que lo contiene.
 */
export default function NombreCaballoLink({ id, nombre, className = '', fallback = '—' }: Props) {
  const navigate = useNavigate()
  const texto = nombre?.trim() || fallback

  if (!id) return <span className={className}>{texto}</span>

  function ir(e: MouseEvent | KeyboardEvent) {
    e.preventDefault()
    e.stopPropagation()
    navigate(`/caballos/${id}/historial`)
  }

  return (
    <span
      role="link"
      tabIndex={0}
      title={`Ver perfil de ${texto}`}
      onClick={ir}
      onKeyDown={(e) => { if (e.key === 'Enter') ir(e) }}
      className={`cursor-pointer underline decoration-dotted decoration-slate-300 underline-offset-2 hover:text-brand-600 hover:decoration-brand-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-400 rounded-sm transition-colors ${className}`}
    >
      {texto}
    </span>
  )
}
