// Helpers de presentación para la entidad `caballo`.

interface CaballoIdentificable {
  nombre?: string | null
  numero_registro?: string | null
}

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
export function textoBusquedaCaballo(caballo: CaballoIdentificable): string {
  return `${caballo.nombre ?? ''} ${caballo.numero_registro ?? ''}`.toLowerCase()
}
