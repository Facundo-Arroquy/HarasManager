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

// Coincide con el RAISE EXCEPTION de crear_caballo_veterinario cuando un vet
// llega al límite freemium (5 caballos propios sin suscripción activa).
export function esLimiteCaballosVet(e: unknown): boolean {
  return mensajeError(e, '').includes('límite de 5 caballos propios')
}
