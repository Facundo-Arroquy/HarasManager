// Helpers de presentación para la entidad `caballo`.

interface CaballoIdentificable {
  nombre?: string | null
  numero_registro?: string | null
  numero_chip?: string | null
}

/**
 * Los chips que se implantan (Datamars Animal iD y cualquier otro ISO
 * 11784/11785) son siempre un número de 15 dígitos, sin letras ni separadores:
 * los 3 primeros identifican al fabricante o al país, los 12 restantes son
 * únicos en el mundo.
 */
export const CHIP_LARGO = 15

/**
 * Dígitos mínimos para que la búsqueda mire el final del chip. Con menos de 4
 * el sufijo coincidiría con demasiados animales y ensuciaría el listado.
 */
const CHIP_BUSQUEDA_MIN_DIGITOS = 4

/**
 * Nombre a mostrar de un caballo. Algunos animales jóvenes de la primera etapa
 * de cría todavía no tienen nombre y se identifican solo por su RP
 * (`numero_registro`). En ese caso se usa el RP como identificador visible.
 */
export function nombreCaballo(caballo: CaballoIdentificable): string {
  const nombre = caballo.nombre?.trim()
  if (nombre) return nombre
  const rp = caballo.numero_registro?.trim()
  if (rp) return `RP ${rp}`
  return 'Sin nombre'
}

/**
 * Texto sobre el que se busca un caballo: nombre + RP, así el filtro de búsqueda
 * encuentra al animal tanto por su nombre como por su número de registro.
 */
function textoBusquedaCaballo(caballo: CaballoIdentificable): string {
  return `${caballo.nombre ?? ''} ${caballo.numero_registro ?? ''}`.toLowerCase()
}

/** Deja solo los dígitos y corta en el largo de un chip. */
export function normalizarChip(valor: string | null | undefined): string {
  return (valor ?? '').replace(/\D/g, '').slice(0, CHIP_LARGO)
}

/** Un chip válido son exactamente 15 dígitos. */
export function esChipValido(chip: string): boolean {
  return /^\d{15}$/.test(chip)
}

/**
 * ¿El caballo coincide con lo que se escribió en el buscador?
 *
 * Además de nombre y RP, se busca por chip: alcanza con tipear los últimos
 * dígitos (mínimo 4) para encontrarlo, y el número completo también coincide,
 * así un lector que "tipea" los 15 dígitos en el buscador cae en el animal.
 */
export function coincideBusquedaCaballo(caballo: CaballoIdentificable, busqueda: string): boolean {
  const q = busqueda.trim().toLowerCase()
  if (!q) return true
  if (textoBusquedaCaballo(caballo).includes(q)) return true

  const chip = normalizarChip(caballo.numero_chip)
  if (!chip) return false
  // Solo se busca por chip si lo tipeado es un número: "4883" sí, "potro 48"
  // no. Se toleran los separadores con los que algunos lectores escriben los
  // 15 dígitos ("981 098109154883").
  const digitos = q.replace(/[\s.-]/g, '')
  if (!/^\d+$/.test(digitos) || digitos.length < CHIP_BUSQUEDA_MIN_DIGITOS) return false
  return chip.endsWith(digitos)
}

/**
 * Camada del caballo como "YYYY-YYYY+1". La temporada arranca en julio: los
 * nacidos de julio a diciembre pertenecen a la camada del año siguiente.
 */
export function getCamada(fechaNacimiento: string | null | undefined): string | null {
  if (!fechaNacimiento) return null
  const date  = new Date(fechaNacimiento + 'T12:00:00')
  const year  = date.getFullYear()
  const month = date.getMonth() + 1
  if (month >= 7) return `${year}-${year + 1}`
  return `${year - 1}-${year}`
}
