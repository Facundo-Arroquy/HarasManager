import type { RecordatorioCria, RolReproductivo } from '../types/crianza'
import { actoResuelveRecordatorio, chipsDeRecordatorio, type ActoCria } from './recordatorio'

/**
 * Los orígenes de actividad del centro (recordatorios, registros clínicos,
 * flushings, ecografías y transferencias) se normalizan a un mismo `Evento`.
 * Después se juntan por yegua y día en una `Tarjeta`: en el programa una yegua
 * aparece una sola vez por día, con todas sus actividades adentro.
 */
export type TipoEvento =
  | 'vencido' | 'pendiente'
  | 'registro' | 'transferencia' | 'flushing' | 'ecografia'

export interface Evento {
  id:            string
  fecha:         string
  caballoId:     string
  caballoNombre: string
  rol:           RolReproductivo
  empresa:       string
  campo:         string
  actividad:     string
  etiqueta:      string
  tipo:          TipoEvento
  veterinario:   string | null
  detalle:       string | null
  /**
   * Solo en los eventos que todavía hay que hacer. Es lo que convierte el clic
   * en "hacer lo agendado" y no en "cargar un registro nuevo": sin esto el
   * recordatorio quedaba pendiente al lado del registro que lo resolvió.
   */
  recordatorio?: RecordatorioCria
  /** Recordatorio ya hecho: se muestra solo si nada de lo cargado lo explica. */
  recordatorioHecho?: RecordatorioCria
  /** Qué se cargó, para saber qué recordatorios hechos del día explica. */
  acto?: ActoCria
}

/** Una yegua en un día, con todas sus actividades (hechas o por hacer). */
export interface Tarjeta {
  id:            string
  fecha:         string
  caballoId:     string
  caballoNombre: string
  rol:           RolReproductivo
  empresa:       string
  campo:         string
  actividades:   Evento[]
  /** Estado del cartel: vencido o falta hacer si queda algo, si no lo hecho. */
  estado:        TipoEvento
  /** "Flushing ✓ | Revisión PG", para la tabla y sus filtros. */
  etiqueta:      string
  veterinario:   string | null
  detalle:       string | null
}

export function esPorHacer(tipo: TipoEvento): boolean {
  return tipo === 'vencido' || tipo === 'pendiente'
}

function unicos(valores: (string | null)[]): string[] {
  return [...new Set(valores.filter((v): v is string => !!v))]
}

/** El recordatorio detrás del evento, esté por hacer o ya hecho. */
function recordatorioDe(e: Evento): RecordatorioCria | undefined {
  return e.recordatorio ?? e.recordatorioHecho
}

/**
 * Un recordatorio y lo que se cargó ese día para hacerlo son el mismo acto: se
 * muestra lo cargado (tiene el detalle) con el nombre de lo que estaba agendado
 * ("Revisión PG" y no un "Revisión" genérico), y nunca "Falta hacer" al lado.
 * Lo agendado queda suelto solo si nada de lo cargado lo explica: sigue por
 * hacer, o se marcó "Hecho" a mano.
 */
function fusionarAgendados(eventos: Evento[]): Evento[] {
  const agendados = eventos.filter((e) => recordatorioDe(e))
  const cargados  = eventos.filter((e) => !recordatorioDe(e))
  const explicados = new Set<string>()

  const fusionados = cargados.map((e) => {
    if (!e.acto) return e
    const resuelve = agendados
      .filter((a) => !explicados.has(a.id) && actoResuelveRecordatorio(recordatorioDe(a)!.tipo, e.acto!))
    if (resuelve.length === 0) return e
    for (const a of resuelve) explicados.add(a.id)
    // El flushing y la eco ya dicen qué fueron; al registro le falta el nombre.
    if (e.acto.clase !== 'registro') return e
    const tipos = resuelve.map((a) => recordatorioDe(a)!.tipo)
    const cubiertos = new Set(tipos.flatMap(chipsDeRecordatorio))
    const chipsSueltos = e.acto.chips.filter((c) => !cubiertos.has(c))
    const etiqueta = unicos([...tipos, ...chipsSueltos]).join(', ')
    return { ...e, actividad: etiqueta, etiqueta }
  })

  return [...agendados.filter((a) => !explicados.has(a.id)), ...fusionados]
}

function estadoTarjeta(actividades: Evento[]): TipoEvento {
  if (actividades.some((a) => a.tipo === 'vencido'))   return 'vencido'
  if (actividades.some((a) => a.tipo === 'pendiente')) return 'pendiente'
  const tipos = new Set(actividades.map((a) => a.tipo))
  return tipos.size === 1 ? actividades[0].tipo : 'registro'
}

/** Junta los eventos en un cartel por yegua y día. */
export function armarTarjetas(eventos: Evento[]): Tarjeta[] {
  const grupos = new Map<string, Evento[]>()
  for (const e of eventos) {
    const clave = `${e.fecha}|${e.caballoId}`
    const grupo = grupos.get(clave)
    if (grupo) grupo.push(e)
    else grupos.set(clave, [e])
  }

  return [...grupos.entries()].map(([clave, grupo]) => {
    const actividades = fusionarAgendados(grupo)
    const base = grupo[0]
    // El rol del registro manda sobre el null de una yegua sin rol todavía.
    const rol = grupo.find((e) => e.rol)?.rol ?? null
    return {
      id:            clave,
      fecha:         base.fecha,
      caballoId:     base.caballoId,
      caballoNombre: grupo.find((e) => e.caballoNombre !== '—')?.caballoNombre ?? base.caballoNombre,
      rol,
      empresa:       base.empresa,
      campo:         base.campo,
      actividades,
      estado:        estadoTarjeta(actividades),
      etiqueta:      actividades
        .map((a) => `${a.etiqueta}${esPorHacer(a.tipo) ? '' : ' ✓'}`)
        .join(' | '),
      veterinario:   unicos(actividades.map((a) => a.veterinario)).join(', ') || null,
      detalle:       unicos(actividades.map((a) => a.detalle)).join(' · ') || null,
    }
  })
}
