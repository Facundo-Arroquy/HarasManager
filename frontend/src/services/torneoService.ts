import { getSupabaseClient } from '../lib/supabase'
import { TAG_JUGADOR } from './tagService'
import type {
  Torneo,
  TorneoJugador,
  CaballoTorneo,
  TableroTorneo,
  NuevoTorneoPayload,
  NuevoJugadorPayload,
  EstadoTorneo,
} from '../types/torneo'

// =============================================================================
// Torneos — migración 20260803120000
// =============================================================================
// La columna "Disponibles" del kanban se arma acá: caballos activos de la
// sociedad con el tag "Jugador" que todavía no están asignados en ese torneo.
// La escritura del tablero va siempre por la RPC `guardar_asignaciones_torneo`,
// que reescribe la columna entera en una transacción (el frontend nunca hace
// UPDATE fila por fila del orden).
// =============================================================================

/** Fila cruda del embed de caballo en las asignaciones. */
interface FilaCaballo {
  id:              string
  nombre:          string | null
  numero_registro: string | null
  categoria:       string | null
  cat_pelaje:      { nombre: string } | null
  campo:           { nombre: string } | null
}

function mapearCaballo(fila: FilaCaballo): CaballoTorneo {
  return {
    id:              fila.id,
    nombre:          fila.nombre ?? '',
    numero_registro: fila.numero_registro,
    categoria:       fila.categoria,
    pelaje:          fila.cat_pelaje?.nombre ?? null,
    campo:           fila.campo?.nombre ?? null,
  }
}

const SELECT_CABALLO = 'id, nombre, numero_registro, categoria, cat_pelaje:pelaje_id(nombre), campo:campo_id(nombre)'

export const torneoService = {
  // ── Torneos ────────────────────────────────────────────────────────────────

  async listar(sociedadId: string): Promise<Torneo[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('torneo')
      .select('*, torneo_jugador(id), torneo_asignacion(id)')
      .eq('sociedad_id', sociedadId)
      .order('created_at', { ascending: false })
    if (error) throw error

    type Fila = Torneo & {
      torneo_jugador:    { id: string }[] | null
      torneo_asignacion: { id: string }[] | null
    }

    return ((data ?? []) as Fila[]).map(({ torneo_jugador, torneo_asignacion, ...torneo }) => ({
      ...torneo,
      cantidad_jugadores: torneo_jugador?.length ?? 0,
      cantidad_asignados: torneo_asignacion?.length ?? 0,
    }))
  },

  async obtener(torneoId: string): Promise<Torneo> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('torneo')
      .select('*')
      .eq('id', torneoId)
      .single()
    if (error) throw error
    return data as Torneo
  },

  async crear(payload: NuevoTorneoPayload): Promise<Torneo> {
    const supabase = getSupabaseClient()
    const { data: sesion } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('torneo')
      .insert({
        sociedad_id:  payload.sociedad_id,
        nombre:       payload.nombre,
        temporada:    payload.temporada,
        fecha_inicio: payload.fecha_inicio,
        fecha_fin:    payload.fecha_fin,
        notas:        payload.notas,
        creado_por:   sesion?.user?.id ?? null,
      })
      .select('*')
      .single()
    if (error) throw error

    const torneo = data as Torneo

    if (payload.jugadores.length > 0) {
      await this.agregarJugadores(torneo.id, payload.jugadores)
    }
    return torneo
  },

  async actualizar(
    torneoId: string,
    cambios: Partial<Pick<Torneo, 'nombre' | 'temporada' | 'fecha_inicio' | 'fecha_fin' | 'estado' | 'notas'>>,
  ): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('torneo').update(cambios).eq('id', torneoId)
    if (error) throw error
  },

  async cambiarEstado(torneoId: string, estado: EstadoTorneo): Promise<void> {
    return this.actualizar(torneoId, { estado })
  },

  /** Borra el torneo con sus jugadores y asignaciones (ON DELETE CASCADE). */
  async eliminar(torneoId: string): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('torneo').delete().eq('id', torneoId)
    if (error) throw error
  },

  // ── Jugadores ──────────────────────────────────────────────────────────────

  async listarJugadores(torneoId: string): Promise<TorneoJugador[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('torneo_jugador')
      .select('*')
      .eq('torneo_id', torneoId)
      .order('orden')
      .order('created_at')
    if (error) throw error
    return (data ?? []) as TorneoJugador[]
  },

  async agregarJugadores(torneoId: string, jugadores: NuevoJugadorPayload[]): Promise<void> {
    if (jugadores.length === 0) return
    const supabase = getSupabaseClient()

    // El orden arranca después del último jugador ya cargado, así el agregado
    // posterior no reordena las columnas existentes.
    const { data: previos, error: errorPrevios } = await supabase
      .from('torneo_jugador')
      .select('orden')
      .eq('torneo_id', torneoId)
      .order('orden', { ascending: false })
      .limit(1)
    if (errorPrevios) throw errorPrevios

    const base = ((previos ?? []) as { orden: number }[])[0]?.orden ?? -1

    const { error } = await supabase.from('torneo_jugador').insert(
      jugadores.map((j, i) => ({
        torneo_id:  torneoId,
        nombre:     j.nombre,
        usuario_id: j.usuario_id ?? null,
        orden:      base + 1 + i,
      })),
    )
    if (error) throw error
  },

  /** Saca al jugador del torneo; sus asignaciones vuelven a disponibles. */
  async quitarJugador(jugadorId: string): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('torneo_jugador').delete().eq('id', jugadorId)
    if (error) throw error
  },

  // ── Tablero ────────────────────────────────────────────────────────────────

  /**
   * Estado completo del kanban en una sola llamada del lado del componente:
   * torneo + columnas + caballos disponibles.
   */
  async cargarTablero(torneoId: string): Promise<TableroTorneo> {
    const supabase = getSupabaseClient()

    const torneo = await this.obtener(torneoId)
    const jugadores = await this.listarJugadores(torneoId)

    const { data: asignaciones, error: errorAsign } = await supabase
      .from('torneo_asignacion')
      .select(`jugador_id, orden, caballo:caballo_id(${SELECT_CABALLO})`)
      .eq('torneo_id', torneoId)
      .order('orden')
    if (errorAsign) throw errorAsign

    type FilaAsignacion = { jugador_id: string; orden: number; caballo: FilaCaballo | null }

    const porJugador: Record<string, CaballoTorneo[]> = {}
    for (const jugador of jugadores) porJugador[jugador.id] = []

    const asignados = new Set<string>()
    for (const fila of (asignaciones ?? []) as unknown as FilaAsignacion[]) {
      if (!fila.caballo) continue
      asignados.add(fila.caballo.id)
      const lista = porJugador[fila.jugador_id]
      if (lista) lista.push(mapearCaballo(fila.caballo))
    }

    const conTag = await this.listarCaballosJugador(torneo.sociedad_id)
    const disponibles = conTag.filter((c) => !asignados.has(c.id))

    return { torneo, jugadores, disponibles, porJugador }
  },

  /**
   * Caballos elegibles para un torneo: activos, de la sociedad y con el tag
   * "Jugador". Es la lista de origen de la columna "Disponibles" — el filtro de
   * los ya asignados lo aplica `cargarTablero`.
   */
  async listarCaballosJugador(sociedadId: string): Promise<CaballoTorneo[]> {
    const supabase = getSupabaseClient()

    const { data: tag, error: errorTag } = await supabase
      .from('cat_tag')
      .select('id')
      .eq('nombre', TAG_JUGADOR)
      .maybeSingle()
    if (errorTag) throw errorTag
    if (!tag) return []

    const { data, error } = await supabase
      .from('caballo')
      .select(`${SELECT_CABALLO}, caballo_tag!inner(tag_id)`)
      .eq('sociedad_id', sociedadId)
      .eq('activo', true)
      .eq('caballo_tag.tag_id', (tag as { id: number }).id)
      .order('nombre')
    if (error) throw error

    return ((data ?? []) as unknown as FilaCaballo[]).map(mapearCaballo)
  },

  /**
   * Reescribe la columna de un jugador con la lista final de caballos.
   * `jugadorId = null` devuelve los caballos a disponibles.
   *
   * Un caballo que venía de otra columna se suelta del jugador anterior dentro
   * de la misma transacción, así que mover entre jugadores es una sola llamada.
   */
  async guardarColumna(
    torneoId: string,
    jugadorId: string | null,
    caballoIds: string[],
  ): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase.rpc('guardar_asignaciones_torneo', {
      p_torneo_id:   torneoId,
      p_jugador_id:  jugadorId,
      p_caballo_ids: caballoIds,
    })
    if (error) throw error
  },
}
