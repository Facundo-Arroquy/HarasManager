import { useEffect, type RefObject } from 'react'

/** Ejecuta `onClose` cuando se hace click fuera del elemento referenciado. */
export function useOutsideClick(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, onClose])
}
