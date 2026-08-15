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
 * WhatsApp de soporte, en formato internacional sin `+` ni separadores
 * (como lo pide `wa.me`). Ej: `5491112345678`.
 *
 * TODO: falta cargar el número real. Mientras esté vacío, la UI no ofrece el
 * canal — ver `HAY_WHATSAPP_SOPORTE`.
 */
export const WHATSAPP_SOPORTE = ''

/**
 * `true` solo si hay un número plausible cargado.
 *
 * La guarda existe para que un placeholder no llegue a la pantalla: sin esto,
 * el botón de WhatsApp mandaría al usuario a un `wa.me/` roto, que es peor que
 * no ofrecer el canal.
 */
export const HAY_WHATSAPP_SOPORTE = /^\d{8,15}$/.test(WHATSAPP_SOPORTE)

/** Link de `wa.me` con el mensaje ya escrito. */
export function whatsappSoporte(mensaje: string): string {
  return `https://wa.me/${WHATSAPP_SOPORTE}?text=${encodeURIComponent(mensaje)}`
}
