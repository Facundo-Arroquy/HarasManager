// =============================================================================
// Máquinas de estado reproductivo — transiciones válidas por rol
// =============================================================================

import type { EstadoReproductivo } from '../types/crianza'

// Nodo = estado actual (null = animal recién asignado al flujo)
// Valor = lista de estados a los que puede avanzar

export const TRANSICIONES_DONANTE: Record<string, EstadoReproductivo[]> = {
  '':           ['revision'],          // sin estado asignado aún
  revision:     ['strelling'],
  strelling:    ['inseminacion'],
  inseminacion: ['oxy'],
  oxy:          ['ov'],
  ov:           ['flushing'],
  flushing:     ['espera', 'pg'],      // espera = positivo, pg = negativo
  pg:           ['revision'],
  espera:       ['revision'],
}

export const TRANSICIONES_RECEPTORA: Record<string, EstadoReproductivo[]> = {
  '':           ['revision'],
  revision:     ['ov', 'pg'],          // ov si progresa, pg si no está lista
  ov:           ['disponible', 'strelling'], // disponible si folículo ok, strelling si no
  strelling:    ['revision'],          // post-Strelling/Ovusynch → vuelve a revisión
  disponible:   ['transferida', 'pg'], // transferida si recibe embrión, pg si no
  transferida:  ['eco1'],
  eco1:         ['eco2', 'vacia'],
  eco2:         ['eco3', 'vacia'],
  eco3:         ['prenada', 'vacia'],
  prenada:      [],                    // estado terminal
  vacia:        ['revision'],
  pg:           ['revision'],
}

export function getTransiciones(
  rol: 'Donante' | 'Receptora',
  estadoActual: EstadoReproductivo,
): EstadoReproductivo[] {
  const mapa = rol === 'Donante' ? TRANSICIONES_DONANTE : TRANSICIONES_RECEPTORA
  return mapa[estadoActual ?? ''] ?? []
}
