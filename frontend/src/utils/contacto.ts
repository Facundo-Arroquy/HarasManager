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

/**
 * WhatsApps a los que puede escribir el usuario.
 *
 * A diferencia de `EMAIL_SOPORTE`, que va a una casilla del equipo, acá no hay
 * un número de producto: son los celulares personales de Tomás y Facundo, los
 * mismos dos contactos comerciales que ya lista `LandingPage`.
 *
 * Formato `wa.me`: sin `+` ni separadores — 54 + 9 (móvil) + característica sin
 * el 0 + número sin el 15.
 */
export const WHATSAPP_CONTACTO = [
  { nombre: 'Facundo', numero: '5492281588804' },
  { nombre: 'Tomás',   numero: '5491123021297' },
] as const

/** Link de `wa.me` con el mensaje ya escrito. */
export function whatsappLink(numero: string, mensaje: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
}
