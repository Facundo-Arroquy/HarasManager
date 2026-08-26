import { diffDias, sumarDias } from './fecha'
import type { RegistroClinicoCria, TransferenciaEmbrionaria } from '../types/crianza'

/**
 * Receptora que ovuló, con los días transcurridos desde esa ovulación.
 *
 * Es lo que pidió Gero para el momento de cargar el flushing: "que aparezcan
 * las receptoras ya ovuladas ordenadas por días después de la ovulación de la
 * receptora en ese orden (+1 +2 etc)".
 */
export interface ReceptoraOvulada {
  caballoId:     string
  nombre:        string
  /** Fecha real de la ovulación, ya descontando `ov_dias` del registro. */
  fechaOv:       string
  /** Días entre la ovulación y la fecha de referencia (la del flushing). */
  diasDesdeOv:   number
  /** Ya recibió una transferencia en este ciclo: se muestra, pero al final. */
  yaTransferida: boolean
}

/**
 * Receptoras ovuladas a una fecha dada, ordenadas por días desde su ovulación.
 *
 * La fecha de ovulación no es la del registro: cuando el vet marca OV puede
 * indicar que ovuló hace N días (`ov_dias`), así que la ovulación real es
 * `fecha - ov_dias`. De cada receptora se toma la ovulación más reciente.
 *
 * NO se filtra por ninguna ventana de aptitud: la lista sale completa y
 * ordenada, y el vet elige. Cuál es el rango que hace apta a una receptora es
 * una definición clínica que todavía no está tomada — cuando esté, se filtra
 * o se resalta acá.
 */
export function receptorasOvuladas(
  registros:      RegistroClinicoCria[],
  transferencias: TransferenciaEmbrionaria[],
  fechaRef:       string
): ReceptoraOvulada[] {
  const ultimaOv = new Map<string, { nombre: string; fechaOv: string }>()

  for (const r of registros) {
    if (r.caballo?.rol_reproductivo !== 'Receptora') continue
    if (!r.ovario_izq.includes('OV') && !r.ovario_der.includes('OV')) continue
    if (r.fecha > fechaRef) continue

    const fechaOv = sumarDias(r.fecha, -(r.ov_dias ?? 0))
    if (fechaOv > fechaRef) continue

    const previa = ultimaOv.get(r.caballo_id)
    if (!previa || fechaOv > previa.fechaOv) {
      ultimaOv.set(r.caballo_id, { nombre: r.caballo?.nombre ?? '—', fechaOv })
    }
  }

  // Una transferencia posterior a la ovulación cierra ese ciclo: la receptora
  // ya está ocupada. Se sigue mostrando —el vet puede tener motivos— pero abajo.
  const transferidaDesde = new Map<string, string>()
  for (const t of transferencias) {
    const previa = transferidaDesde.get(t.caballo_receptora_id)
    if (!previa || t.fecha > previa) transferidaDesde.set(t.caballo_receptora_id, t.fecha)
  }

  const salida: ReceptoraOvulada[] = []
  for (const [caballoId, { nombre, fechaOv }] of ultimaOv) {
    const ultimaTransf = transferidaDesde.get(caballoId)
    salida.push({
      caballoId,
      nombre,
      fechaOv,
      diasDesdeOv:   diffDias(fechaOv, fechaRef),
      yaTransferida: Boolean(ultimaTransf && ultimaTransf >= fechaOv),
    })
  }

  return salida.sort((a, b) => {
    if (a.yaTransferida !== b.yaTransferida) return a.yaTransferida ? 1 : -1
    if (a.diasDesdeOv !== b.diasDesdeOv) return a.diasDesdeOv - b.diasDesdeOv
    return a.nombre.localeCompare(b.nombre)
  })
}
