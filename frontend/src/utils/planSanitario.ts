import type { EstadoTrabajoSanitario, TrabajoSanitario } from '../types/sanidad'

/** Los trabajos de un mismo plan que caen el mismo día, sobre el mismo padrón. */
export interface GrupoPlan {
  clave:        string
  /** Título combinado: "Vacuna 1 + Vacuna 2". */
  titulo:       string
  fecha:        string
  estado:       EstadoTrabajoSanitario
  /** Caballos distintos alcanzados, aunque no estén en todos los trabajos. */
  nCaballos:    number
  tratamientos: string
  trabajos:     TrabajoSanitario[]
}

/**
 * Junta en una sola entrada los trabajos de un mismo plan y día. Vienen
 * separados porque cada uno es una columna de la grilla (vacuna 1, vacuna 2),
 * pero para quien mira la agenda son una sola salida al campo: tres vacunas
 * cargadas juntas, dos el 20 y una el 21, son dos entradas y no tres.
 *
 * La clave incluye al dueño: un plan cargado por un veterinario puede mezclar
 * empresas, y cada padrón sigue siendo su propia entrada para que el chip de
 * empresa siga significando algo.
 */
export function agruparPorPlan(trabajos: TrabajoSanitario[]): GrupoPlan[] {
  const mapa = new Map<string, TrabajoSanitario[]>()
  for (const t of trabajos) {
    const clave = `${t.plan_id}|${t.fecha_programada}|${t.sociedad_id ?? t.vet_owner_id ?? ''}`
    ;(mapa.get(clave) ?? mapa.set(clave, []).get(clave)!).push(t)
  }

  return [...mapa.entries()].map(([clave, ts]) => {
    const nombres = [...new Set(ts.map((t) => t.nombre))]
    return {
      clave,
      titulo: nombres.length <= 3
        ? nombres.join(' + ')
        : `${nombres.slice(0, 2).join(' + ')} +${nombres.length - 2} más`,
      fecha: ts[0].fecha_programada,
      // Mientras quede un trabajo sin cerrar, el plan del día sigue pendiente.
      estado: ts.some((t) => t.estado === 'pendiente')
        ? 'pendiente'
        : ts.every((t) => t.estado === 'cancelado') ? 'cancelado' : 'realizado',
      nCaballos: new Set(ts.flatMap((t) => (t.caballos ?? []).map((c) => c.caballo_id))).size,
      tratamientos: [...new Set(ts.map((t) => t.tratamiento).filter(Boolean))].join(' · '),
      trabajos: ts,
    }
  })
}
