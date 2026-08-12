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
// llega a su tope de caballos propios — el del plan gratuito o el de la
// membresía, según corresponda.
//
// Se mira el SQLSTATE y no el texto: el mensaje cambia según el plan y lleva
// los números adentro, así que engancharse a él lo hace frágil. `HM001` es el
// código que la función levanta a propósito para este caso.
export function esLimiteCaballosVet(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code
  if (code === 'HM001') return true
  // Respaldo por si el error llega envuelto y pierde el código.
  return /límite de \d+ caballos propios/.test(mensajeError(e, ''))
}
