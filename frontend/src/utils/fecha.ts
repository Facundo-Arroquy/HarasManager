const AR_TZ = 'America/Argentina/Buenos_Aires'

/** Retorna la fecha de hoy en Argentina como 'YYYY-MM-DD'. */
export function hoyAR(): string {
  // 'sv' locale formatea como YYYY-MM-DD, perfecto para comparaciones
  return new Intl.DateTimeFormat('sv', { timeZone: AR_TZ }).format(new Date())
}

/**
 * Formatea una fecha ISO a dd/MM/yyyy en timezone Argentina.
 * Soporta tanto datetime ('2026-04-10T10:00:00Z') como date-only ('2026-04-17').
 */
export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const opts: Intl.DateTimeFormatOptions = {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: AR_TZ,
  }
  if (iso.includes('T') || iso.includes(' ')) {
    // Datetime: parsear como UTC y mostrar en AR
    return new Date(iso).toLocaleDateString('es-AR', opts)
  }
  // Date-only ('YYYY-MM-DD'): construir como fecha local para evitar el shift UTC
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

/**
 * Formatea una fecha ISO a formato corto ("10 may.") en timezone Argentina.
 */
export function formatFechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—'
  const opts: Intl.DateTimeFormatOptions = {
    day: 'numeric', month: 'short',
    timeZone: AR_TZ,
  }
  if (iso.includes('T') || iso.includes(' ')) {
    return new Date(iso).toLocaleDateString('es-AR', opts)
  }
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

/**
 * Calcula la edad en años a partir de una fecha de nacimiento 'YYYY-MM-DD'.
 */
export function calcularEdad(fechaNacimiento: string | null | undefined): string {
  if (!fechaNacimiento) return '—'
  const [y, m, d] = fechaNacimiento.split('-').map(Number)
  const nac = new Date(y, m - 1, d)      // fecha local, sin offset UTC
  const hoy = new Date()
  let años = hoy.getFullYear() - nac.getFullYear()
  const diff = hoy.getMonth() - nac.getMonth()
  if (diff < 0 || (diff === 0 && hoy.getDate() < nac.getDate())) años--
  return `${años} año${años !== 1 ? 's' : ''}`
}
