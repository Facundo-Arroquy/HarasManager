import { useEffect } from 'react'

/** Cierra un modal/overlay al presionar Escape. */
export function useEscapeClose(onClose: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])
}
