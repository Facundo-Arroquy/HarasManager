/**
 * Dirección a la que se manda al usuario cuando la app no puede resolverle el
 * problema sola — hoy, el vet que llegó al tope de caballos de su membresía.
 *
 * Está acá y no escrita en cada componente para que cambiarla sea una línea.
 * `LandingPage` mantiene su propia lista de contactos comerciales (las casillas
 * personales de Tomás y Facundo), que es otra cosa: esto es soporte de
 * producto, y por eso va a una casilla del equipo y no a una persona.
 */
export const EMAIL_SOPORTE = 'admin.haras@harasmanager.com'

/** `mailto:` con asunto y cuerpo, para que la consulta llegue ya clasificada. */
export function mailtoSoporte(asunto: string, cuerpo?: string): string {
  const params = [`subject=${encodeURIComponent(asunto)}`]
  if (cuerpo) params.push(`body=${encodeURIComponent(cuerpo)}`)
  return `mailto:${EMAIL_SOPORTE}?${params.join('&')}`
}
