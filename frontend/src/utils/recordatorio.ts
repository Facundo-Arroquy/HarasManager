import type {
  RecordatorioCria,
  TransferenciaEmbrionaria,
  RegistroClinicoCria,
  Flushing,
  Ecografia,
} from '../types/crianza'

/** Recordatorios que se resuelven cargando una ecografía, no un registro. */
export const TIPOS_ECO = ['Eco 1', 'Eco 2', 'Eco 3']

/**
 * Qué modal abre un recordatorio al ir a hacerlo. Vive acá y no en cada página
 * porque el programa semanal y la lista de recordatorios son dos entradas al
 * mismo acto: si divergen, una de las dos deja el recordatorio sin cerrar.
 */
export type AccionRecordatorio =
  | { modal: 'registro'; recordatorio: RecordatorioCria }
  | { modal: 'flushing'; recordatorio: RecordatorioCria }
  | { modal: 'eco'; recordatorio: RecordatorioCria; transferencia: TransferenciaEmbrionaria }
  /** Es una eco pero no se encontró de qué transferencia: no hay qué abrir. */
  | { modal: 'falta-transferencia'; recordatorio: RecordatorioCria }

export function accionParaRecordatorio(
  rec: RecordatorioCria,
  transferencias: TransferenciaEmbrionaria[],
): AccionRecordatorio {
  if (rec.tipo === 'Flushing') return { modal: 'flushing', recordatorio: rec }

  if (TIPOS_ECO.includes(rec.tipo)) {
    // La eco cuelga de la transferencia y el recordatorio solo guarda la
    // receptora: se toma la última transferencia suya anterior al vencimiento.
    // Cuando `cria_recordatorio` tenga `transferencia_id`, esto se borra.
    const transferencia = transferencias
      .filter((t) => t.caballo_receptora_id === rec.caballo_id && t.fecha <= rec.fecha_vto)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
    return transferencia
      ? { modal: 'eco', recordatorio: rec, transferencia }
      : { modal: 'falta-transferencia', recordatorio: rec }
  }

  return { modal: 'registro', recordatorio: rec }
}

/** Lo que se cargó para cerrar un recordatorio, si quedó rastro. */
export type FichaRecordatorio =
  | { clase: 'registro';  registro:  RegistroClinicoCria }
  | { clase: 'flushing';  flushing:  Flushing }
  | { clase: 'ecografia'; ecografia: Ecografia }
  | null

/**
 * `null` no significa "no se hizo": los recordatorios cerrados antes de que
 * existiera `origen_recordatorio_id` no tienen con qué enlazarse, y "Hecho" a
 * secas nunca registró nada.
 */
export function fichaDeRecordatorio(
  rec: RecordatorioCria,
  datos: {
    registros:  RegistroClinicoCria[]
    flushings:  Flushing[]
    ecografias: Ecografia[]
  },
): FichaRecordatorio {
  const registro = datos.registros.find((r) => r.origen_recordatorio_id === rec.id)
  if (registro) return { clase: 'registro', registro }

  const flushing = datos.flushings.find((f) => f.origen_recordatorio_id === rec.id)
  if (flushing) return { clase: 'flushing', flushing }

  const ecografia = datos.ecografias.find((e) => e.origen_recordatorio_id === rec.id)
  if (ecografia) return { clase: 'ecografia', ecografia }

  return null
}
