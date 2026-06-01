import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'

interface TooltipProps {
  text: string
}

export default function Tooltip({ text }: TooltipProps) {
  const [show, setShow]     = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  function calcCoords() {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setCoords({ top: r.top, left: r.left + r.width / 2 })
  }

  function open()   { calcCoords(); setShow(true) }
  function close()  { setShow(false) }
  function toggle() { if (show) close(); else open() }

  return (
    <span className="inline-flex shrink-0 items-center">
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
        onClick={toggle}
        className="text-slate-400 hover:text-slate-500 transition-colors"
        aria-label="Más información"
      >
        <Info size={13} />
      </button>

      {show && createPortal(
        <div
          style={{
            position: 'fixed',
            top: coords.top - 8,
            left: coords.left,
            transform: 'translate(-50%, -100%)',
            zIndex: 9999,
          }}
          className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs leading-relaxed text-slate-600 shadow-lg pointer-events-none"
        >
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-200" />
        </div>,
        document.body,
      )}
    </span>
  )
}
