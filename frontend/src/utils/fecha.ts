/**
 * Formatea una fecha ISO a dd/MM/yyyy (formato argentino).
 */
export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Calcula la edad en años a partir de una fecha de nacimiento ISO.
 */
export function calcularEdad(fechaNacimiento: string | null | undefined): string {
  if (!fechaNacimiento) return '—'
  const hoy = new Date()
  const nac = new Date(fechaNacimiento)
  let años = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) años--
  return `${años} año${años !== 1 ? 's' : ''}`
}
