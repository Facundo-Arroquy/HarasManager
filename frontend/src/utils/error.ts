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

// Coincide con el SQLSTATE propio ('HM001') que usa crear_caballo_veterinario
// al rechazar el alta por límite freemium — no con el texto del mensaje, que
// puede cambiar de redacción o de idioma sin que este chequeo se entere.
export function esLimiteCaballosVet(e: unknown): boolean {
  if (e && typeof e === 'object' && 'code' in e) {
    return (e as { code?: unknown }).code === 'HM001'
  }
  return false
}
