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

// Los dos topes de caballos propios de un vet, que `crear_caballo_veterinario`
// levanta con SQLSTATE distintos porque la salida de cada uno es distinta:
//
//   HM001 — plan gratuito lleno. Se le ofrece el checkout.
//   HM002 — membresía llena. Ya paga: se lo manda a soporte.
//
// Se mira el código y no el texto: los mensajes llevan los números adentro y
// cambian según el plan, así que engancharse a ellos es frágil.
function tieneCodigo(e: unknown, codigo: string): boolean {
  return (e as { code?: unknown } | null)?.code === codigo
}

/** Tope del plan gratuito: la salida es activar la membresía. */
export function esLimiteCaballosVet(e: unknown): boolean {
  if (tieneCodigo(e, 'HM001')) return true
  // Respaldo por si el error llega envuelto y pierde el código.
  return /límite de \d+ caballos propios del plan gratuito/.test(mensajeError(e, ''))
}

/** Tope de la membresía: no hay nada que vender, la salida es soporte. */
export function esLimiteMembresiaVet(e: unknown): boolean {
  if (tieneCodigo(e, 'HM002')) return true
  return /límite de \d+ caballos propios que incluye la membresía/.test(mensajeError(e, ''))
}

/**
 * El N° de chip ya está cargado en otro caballo: choca con el índice único de
 * `caballo.numero_chip` (23505 = unique_violation).
 */
export function esChipDuplicado(e: unknown): boolean {
  if (!tieneCodigo(e, '23505')) return false
  return /chip/i.test(mensajeError(e, ''))
}
