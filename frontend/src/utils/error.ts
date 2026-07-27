// Extrae un mensaje legible de cualquier error capturado (Supabase, Error, etc.)
// sin recurrir a `any`. Los errores de Supabase son objetos planos con `message`.
export function mensajeError(e: unknown, fallback = 'Error desconocido'): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  if (e && typeof e === 'object' && 'message' in e) {
    const msg = (e as { message?: unknown }).message
    if (typeof msg === 'string') return msg
  }
  return fallback
}
