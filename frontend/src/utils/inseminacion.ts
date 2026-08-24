import type { RegistroClinicoCria } from '../types/crianza'

/** Inseminación de la que sale el padrillo de un flushing. */
export interface InseminacionPrevia {
  padrilloId: string
  /** Fecha del registro con el chip IN. */
  fecha:      string
}

/**
 * Última inseminación de una donante hasta una fecha dada.
 *
 * El padrillo se define cuando se insemina, no cuando se flushea: al cargar el
 * flushing ya está determinado por el registro con el chip IN. Esto lo busca
 * para precargarlo en vez de volver a preguntarlo.
 *
 * Se toma la inseminación más reciente anterior o igual a la fecha del flushing;
 * si la donante tiene ciclos viejos, no se arrastra el padrillo de un ciclo
 * anterior sin más: por eso el corte por fecha.
 */
export function ultimaInseminacion(
  registros:  RegistroClinicoCria[],
  donanteId:  string,
  fechaRef:   string
): InseminacionPrevia | null {
  let mejor: InseminacionPrevia | null = null

  for (const r of registros) {
    if (r.caballo_id !== donanteId) continue
    if (!r.obs_chips.includes('IN')) continue
    if (!r.padrillo_id) continue
    if (r.fecha > fechaRef) continue

    if (!mejor || r.fecha > mejor.fecha) {
      mejor = { padrilloId: r.padrillo_id, fecha: r.fecha }
    }
  }

  return mejor
}
