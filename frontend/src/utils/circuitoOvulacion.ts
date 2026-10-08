import type { RecordatorioCria } from '../types/crianza'

/**
 * Circuito de seguimiento de la donante después de cada inseminación (pedido
 * "Donantes – circuito automático después de la inseminación", 2026-10-08):
 *
 *   IN → +1 OXI → +2 Chequear ovulación (+ Reinseminar a las 48 h)
 *      → Chequear ovulación cada día hasta que aparezca OV en algún ovario.
 *
 * - Cada IN arranca un circuito nuevo y deja sin efecto lo abierto del anterior.
 * - La OV en cualquiera de los dos ovarios lo cierra.
 * - "Reinseminar" se agenda una sola vez por IN, a las 48 h (ventana del
 *   semen). Si el vet decide no reinseminar, el circuito se cierra: no vuelve a
 *   aparecer Reinseminar a los 4 días solo por el paso del tiempo. Para volver
 *   a empezar hace falta una IN nueva.
 *
 * El circuito no tiene tabla propia: vive en los recordatorios abiertos de la
 * yegua con estos dos tipos, colgados (origen_registro_id) del registro de la IN.
 * Las reglas que crean recordatorios están en `reglasParaRegistro` (crianzaStore);
 * acá está qué le hace un registro nuevo a los que ya estaban abiertos.
 */

export const TIPO_CHEQUEAR_OV = 'Chequear ovulación'
export const TIPO_REINSEMINAR = 'Reinseminar'
export const TIPOS_CIRCUITO_OV = [TIPO_CHEQUEAR_OV, TIPO_REINSEMINAR]

/** Ventana aproximada del semen: a los 2 días sin OV se ofrece reinseminar. */
export const DIAS_VENTANA_SEMEN = 2

export const MOTIVO_NO_REINSEMINAR = 'No reinseminar: decisión del veterinario'
export const MOTIVO_CIRCUITO_NO_REINSEMINAR = 'Circuito cerrado: se decidió no reinseminar'
export const MOTIVO_OVULADA = 'Circuito cerrado: ovulada (OV)'
export const MOTIVO_NUEVA_IN = 'Nueva inseminación: el circuito vuelve a empezar'

type RegistroCircuito = {
  fecha:      string
  obs_chips:  string[]
  ovario_izq: string[]
  ovario_der: string[]
}

export function tieneOV(r: Pick<RegistroCircuito, 'ovario_izq' | 'ovario_der'>): boolean {
  return r.ovario_izq.includes('OV') || r.ovario_der.includes('OV')
}

export interface CambiosCircuito {
  /** Se hicieron con este registro: el chequeo del día (o atrasado), la reinseminación. */
  hechos:     string[]
  /** Quedan sin efecto, todos por el mismo motivo. */
  cancelados: string[]
  motivo:     string | null
}

/**
 * Qué pasa con los recordatorios abiertos del circuito (`abiertos`, de la
 * misma yegua) cuando se carga un registro de la donante.
 *
 * - Un chequeo agendado para ese día o antes queda hecho: el registro es el
 *   control de ovarios, aunque se haga con atraso.
 * - Un Reinseminar vencido o del día queda hecho si el registro trae IN.
 * - OV cierra el circuito: lo que quede abierto se cancela.
 * - IN sin OV arranca un circuito nuevo: lo que quede abierto del anterior se
 *   cancela (el nuevo agenda sus propios OXI, chequeo y reinseminación).
 * - Cualquier otro registro deja el resto como está: un Reinseminar sin
 *   decidir sigue esperando la decisión del vet, y no se regenera.
 */
export function cambiosCircuitoPorRegistro(
  registro: RegistroCircuito,
  abiertos: Pick<RecordatorioCria, 'id' | 'tipo' | 'fecha_vto'>[],
): CambiosCircuito {
  const ov = tieneOV(registro)
  const inseminada = registro.obs_chips.includes('IN')

  const hechos = abiertos
    .filter((r) => r.fecha_vto <= registro.fecha &&
      (r.tipo === TIPO_CHEQUEAR_OV || (r.tipo === TIPO_REINSEMINAR && inseminada)))
    .map((r) => r.id)

  const motivo = ov ? MOTIVO_OVULADA : inseminada ? MOTIVO_NUEVA_IN : null
  const cancelados = motivo
    ? abiertos.filter((r) => !hechos.includes(r.id)).map((r) => r.id)
    : []

  return { hechos, cancelados, motivo: cancelados.length > 0 ? motivo : null }
}

/**
 * Si este registro hace el control de un chequeo de ovulación agendado para
 * ese día o antes. Sin OV ni IN nueva, es lo que agenda el chequeo de mañana.
 */
export function controlaChequeoAbierto(fecha: string, fechasChequeosAbiertos: string[]): boolean {
  return fechasChequeosAbiertos.some((f) => f <= fecha)
}
