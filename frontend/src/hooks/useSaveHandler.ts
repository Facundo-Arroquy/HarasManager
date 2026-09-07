import { useCallback, useState } from 'react'
import { mensajeError } from '../utils/error'

/**
 * Encapsula el ciclo saving → error → finally de un submit async.
 *
 * La función `execute` recibe un callback async; el hook se encarga de
 * `setSaving(true)`, limpiar el error, y hacer try/catch/finally.
 */
export function useSaveHandler(defaultErrorMsg?: string) {
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const execute = useCallback(async (fn: () => Promise<void>) => {
    setSaving(true)
    setError(null)
    try {
      await fn()
    } catch (err: unknown) {
      setError(mensajeError(err, defaultErrorMsg))
    } finally {
      setSaving(false)
    }
  }, [defaultErrorMsg])

  return { saving, error, setError, execute } as const
}
