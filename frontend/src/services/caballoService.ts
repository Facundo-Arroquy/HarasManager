import { getSupabaseClient } from '../lib/supabase'
import type { BulkCaballoPayload } from '../utils/importarCaballos'
import { tagService, type Tag } from './tagService'

export type Subcategoria = 'Donante' | 'Receptora'

export type Sexo = 'H' | 'M'
export type CategoriaCaballo = 'Caballo' | 'Yegua' | 'Padrillo' | 'Potrillo'

/**
 * Sexo que implica cada categoría. 'Potrillo' queda fuera a propósito: una cría
 * puede ser de cualquier sexo y es el único caso donde hay que preguntarlo.
 */
const SEXO_POR_CATEGORIA: Partial<Record<CategoriaCaballo, Sexo>> = {
  Yegua:    'H',
  Padrillo: 'M',
  Caballo:  'M',
}

/** True si la categoría no determina el sexo y hay que pedirlo en el formulario. */
export function categoriaRequiereSexo(categoria: string): boolean {
  return !(categoria in SEXO_POR_CATEGORIA)
}

/**
 * Sexo definitivo de un caballo. Para Yegua/Padrillo/Caballo se deriva de la
 * categoría —pedirlo sería redundante y admitiría contradicciones—, y solo en
 * 'Potrillo' se respeta lo que haya elegido el usuario.
 */
export function resolverSexo(categoria: string, sexoElegido?: Sexo | null): Sexo | null {
  return SEXO_POR_CATEGORIA[categoria as CategoriaCaballo] ?? sexoElegido ?? null
}

export interface Caballo {
  id: string
  nombre: string
  fecha_nacimiento: string | null
  categoria: string
  sexo?: Sexo | null
  observaciones?: string | null
  /** Domador a cargo — texto libre, no es un usuario del sistema. */
  domador?: string | null
  rol_reproductivo?: string | null
  estado_reproductivo?: string | null
  prenada?: boolean
  fecha_prenez?: string | null
  raza_id: number | null
  pelaje_id: number | null
  numero_chip?: string
  numero_registro?: string
  sociedad_id: string
  campo_id?: string | null
  activo: boolean
  cat_raza?: { nombre: string } | null
  cat_pelaje?: { nombre: string } | null
  campo?: { nombre: string } | null
  padre_id?: string | null
  padre_nombre?: string | null
  madre_id?: string | null
  madre_nombre?: string | null
  propietario_nombre?: string | null
  tags?: Tag[]
  // Presentes solo cuando el listado viene del veterinario (multi-empresa)
  empresa_id?: string | null
  empresa_nombre?: string | null
  /**
   * Vet dueño del caballo: lo creó él y nunca lo transfirió a una empresa.
   * Solo viaja en `get_caballos_veterinario`. No es lo mismo que
   * `sociedad_id === null`: un caballo propio compartido con otro vet le llega
   * al colega también sin sociedad, y no es suyo.
   */
  vet_owner_id?: string | null
}

/** Referencia mínima para los combos de padre/madre — incluye dados de baja. */
export interface CaballoPedigree {
  id:        string
  nombre:    string
  categoria: string
  activo:    boolean
}

/** Categorías que pueden figurar como padre / madre en el pedigree. */
export const CATEGORIAS_PADRE = ['Caballo', 'Padrillo']
export const CATEGORIAS_MADRE = ['Yegua']

/** Fila cruda de `caballo_tag(cat_tag(...))` embebida en los selects. */
type FilaTag = { cat_tag: Tag | null }

function mapearTags(row: { caballo_tag?: FilaTag[] | null }): Tag[] {
  return (row.caballo_tag ?? [])
    .map((t) => t.cat_tag)
    .filter((t): t is Tag => t !== null)
}

/** Fila cruda que devuelve la RPC `get_caballos_veterinario`. */
interface CaballoVetRow {
  id: string
  raza_nombre?: string | null
  pelaje_nombre?: string | null
  campo_nombre?: string | null
  propietario_nombre?: string | null
  prenada?: boolean | null
  fecha_prenez?: string | null
  [key: string]: unknown
}

export interface ActualizarCaballoPayload {
  nombre: string
  fecha_nacimiento?: string | null
  categoria: CategoriaCaballo
  sexo?: Sexo | null
  observaciones?: string | null
  domador?: string | null
  rol_reproductivo?: Subcategoria | null
  prenada?: boolean
  fecha_prenez?: string | null
  raza_id?: number | null
  pelaje_id?: number | null
  numero_chip?: string
  numero_registro?: string
  campo_id?: string | null
  padre_id?: string | null
  padre_nombre?: string | null
  madre_id?: string | null
  madre_nombre?: string | null
}

export interface NuevoCaballoPayload {
  nombre: string
  fecha_nacimiento?: string | null
  categoria: CategoriaCaballo
  sexo?: Sexo | null
  observaciones?: string | null
  domador?: string | null
  rol_reproductivo?: Subcategoria | null
  raza_id?: number | null
  pelaje_id?: number | null
  numero_chip?: string
  numero_registro?: string
  campo_id?: string | null
  padre_id?: string | null
  padre_nombre?: string | null
  madre_id?: string | null
  madre_nombre?: string | null
}

export const caballoService = {
  /** Todos los caballos del vet, a través de todas las empresas en que tiene acceso */
  async listarDelVeterinario(): Promise<Caballo[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('get_caballos_veterinario')
    if (error) throw error
    const rows = data ?? []

    // get_caballos_veterinario puede no devolver prenada/fecha_prenez si fue
    // creado antes de esas columnas. Las obtenemos con una query directa.
    const typedRows = rows as CaballoVetRow[]
    const ids = typedRows.map((c) => c.id)
    const prenMap = new Map<string, { prenada: boolean; fecha_prenez: string | null }>()
    if (ids.length > 0) {
      const { data: prenData } = await supabase
        .from('caballo')
        .select('id, prenada, fecha_prenez')
        .in('id', ids)
      ;((prenData ?? []) as { id: string; prenada: boolean | null; fecha_prenez: string | null }[])
        .forEach((p) => prenMap.set(p.id, { prenada: p.prenada ?? false, fecha_prenez: p.fecha_prenez ?? null }))
    }

    // Los tags no viajan en la RPC — se piden aparte (RLS los filtra igual).
    const tagsMap = ids.length > 0
      ? await tagService.porCaballos(ids).catch(() => new Map<string, Tag[]>())
      : new Map<string, Tag[]>()

    return typedRows.map((c) => ({
      ...c,
      prenada:           prenMap.get(c.id)?.prenada      ?? c.prenada      ?? false,
      fecha_prenez:      prenMap.get(c.id)?.fecha_prenez ?? c.fecha_prenez ?? null,
      cat_raza:          c.raza_nombre        ? { nombre: c.raza_nombre }        : null,
      cat_pelaje:        c.pelaje_nombre      ? { nombre: c.pelaje_nombre }      : null,
      campo:             c.campo_nombre       ? { nombre: c.campo_nombre }       : null,
      propietario_nombre: c.propietario_nombre ?? null,
      tags:              tagsMap.get(c.id) ?? [],
    })) as unknown as Caballo[]
  },

  /**
   * Caballos elegibles como padre/madre. A diferencia de `listar`, incluye los
   * dados de baja: el pedigree es histórico y un progenitor puede estar muerto.
   */
  async listarParaPedigree(sociedadId: string): Promise<CaballoPedigree[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('caballo')
      .select('id, nombre, categoria, activo')
      .eq('sociedad_id', sociedadId)
      .order('nombre')
    if (error) throw error
    return (data ?? []) as CaballoPedigree[]
  },

  /** Ídem para el vet: `get_caballos_veterinario` filtra los inactivos. */
  async listarParaPedigreeVet(): Promise<CaballoPedigree[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('get_caballos_pedigree_vet')
    if (error) throw error
    return (data ?? []) as CaballoPedigree[]
  },

  async listar(sociedadId: string): Promise<Caballo[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('caballo')
      .select(`
        id, nombre, fecha_nacimiento, categoria, rol_reproductivo, estado_reproductivo, prenada, fecha_prenez, campo_id,
        sexo, observaciones, domador,
        raza_id, pelaje_id, numero_chip, numero_registro, activo,
        padre_id, padre_nombre, madre_id, madre_nombre,
        cat_raza(nombre),
        cat_pelaje(nombre),
        campo(nombre),
        caballo_tag(cat_tag(id, nombre, color, activo))
      `)
      .eq('sociedad_id', sociedadId)
      .eq('activo', true)
      .order('nombre')
    if (error) throw error
    return ((data ?? []) as unknown as (Caballo & { caballo_tag?: FilaTag[] })[])
      .map((c) => ({ ...c, tags: mapearTags(c) }))
  },

  /** Caballos dados de baja (inactivos) de la sociedad. */
  async listarDadosDeBaja(sociedadId: string): Promise<Caballo[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('caballo')
      .select(`
        id, nombre, fecha_nacimiento, categoria, rol_reproductivo, estado_reproductivo, prenada, fecha_prenez, campo_id,
        sexo, observaciones, domador,
        raza_id, pelaje_id, numero_chip, numero_registro, activo,
        padre_id, padre_nombre, madre_id, madre_nombre,
        cat_raza(nombre),
        cat_pelaje(nombre),
        campo(nombre),
        caballo_tag(cat_tag(id, nombre, color, activo))
      `)
      .eq('sociedad_id', sociedadId)
      .eq('activo', false)
      .order('nombre')
    if (error) throw error
    return ((data ?? []) as unknown as (Caballo & { caballo_tag?: FilaTag[] })[])
      .map((c) => ({ ...c, tags: mapearTags(c) }))
  },

  async obtener(id: string) {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('caballo')
      .select(`
        id, nombre, fecha_nacimiento, categoria, sexo, observaciones, domador, rol_reproductivo, estado_reproductivo, prenada, fecha_prenez,
        numero_chip, numero_registro, activo, sociedad_id, campo_id,
        raza_id, pelaje_id,
        padre_id, padre_nombre, madre_id, madre_nombre,
        cat_raza(id, nombre),
        cat_pelaje(id, nombre),
        campo(nombre)
      `)
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  async crearParaVet(payload: NuevoCaballoPayload, _vetId: string) {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('crear_caballo_veterinario', {
      p_nombre:           payload.nombre,
      p_fecha_nacimiento: payload.fecha_nacimiento,
      p_categoria:        payload.categoria,
      p_raza_id:          payload.raza_id,
      p_pelaje_id:        payload.pelaje_id,
      p_numero_chip:      payload.numero_chip ?? null,
      p_numero_registro:  payload.numero_registro ?? null,
    })
    if (error) throw error

    const nuevoId = data as string
    // `crear_caballo_veterinario` no toma padre/madre ni campo. Se completan con
    // la RPC de edición y no con un UPDATE directo: la única policy de UPDATE
    // sobre `caballo` es `es_admin(sociedad_id)`, y los caballos propios del vet
    // tienen `sociedad_id NULL`, así que el update directo no afectaba ninguna
    // fila y los datos se perdían en silencio.
    // `sexo` y `observaciones` tampoco los toma la RPC de creación, así que se
    // completan por el mismo camino.
    const tieneGenealogia = payload.padre_id || payload.padre_nombre || payload.madre_id || payload.madre_nombre
    const tieneSexo = resolverSexo(payload.categoria, payload.sexo) !== null
    if (tieneGenealogia || payload.campo_id || tieneSexo || payload.observaciones || payload.domador) {
      await caballoService.actualizarComoVet(nuevoId, {
        nombre:           payload.nombre,
        fecha_nacimiento: payload.fecha_nacimiento,
        categoria:        payload.categoria,
        sexo:             payload.sexo          ?? null,
        observaciones:    payload.observaciones ?? null,
        domador:          payload.domador       ?? null,
        rol_reproductivo: payload.rol_reproductivo ?? null,
        raza_id:          payload.raza_id,
        pelaje_id:        payload.pelaje_id,
        numero_chip:      payload.numero_chip     ?? undefined,
        numero_registro:  payload.numero_registro ?? undefined,
        campo_id:         payload.campo_id        ?? null,
        padre_id:         payload.padre_id        ?? null,
        padre_nombre:     payload.padre_nombre    ?? null,
        madre_id:         payload.madre_id        ?? null,
        madre_nombre:     payload.madre_nombre    ?? null,
      })
    }

    return { id: nuevoId }
  },

  async crear(payload: NuevoCaballoPayload, sociedadId: string) {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('caballo')
      .insert({
        nombre:           payload.nombre,
        fecha_nacimiento: payload.fecha_nacimiento,
        categoria:        payload.categoria,
        rol_reproductivo: payload.rol_reproductivo ?? null,
        raza_id:          payload.raza_id,
        pelaje_id:        payload.pelaje_id,
        numero_chip:      payload.numero_chip,
        numero_registro:  payload.numero_registro,
        sociedad_id:      sociedadId,
        campo_id:         payload.campo_id ?? null,
        padre_id:         payload.padre_id    ?? null,
        padre_nombre:     payload.padre_nombre ?? null,
        madre_id:         payload.madre_id    ?? null,
        madre_nombre:     payload.madre_nombre ?? null,
        sexo:             resolverSexo(payload.categoria, payload.sexo),
        observaciones:    payload.observaciones ?? null,
        domador:          payload.domador ?? null,
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async actualizar(id: string, payload: ActualizarCaballoPayload): Promise<void> {
    const supabase = getSupabaseClient()
    const update: Record<string, unknown> = {
      nombre:           payload.nombre,
      fecha_nacimiento: payload.fecha_nacimiento,
      categoria:        payload.categoria,
      rol_reproductivo: payload.rol_reproductivo ?? null,
      raza_id:          payload.raza_id,
      pelaje_id:        payload.pelaje_id,
      numero_chip:      payload.numero_chip ?? null,
      numero_registro:  payload.numero_registro ?? null,
      campo_id:         payload.campo_id ?? null,
      padre_id:         payload.padre_id    ?? null,
      padre_nombre:     payload.padre_nombre ?? null,
      madre_id:         payload.madre_id    ?? null,
      madre_nombre:     payload.madre_nombre ?? null,
      sexo:             resolverSexo(payload.categoria, payload.sexo),
      observaciones:    payload.observaciones ?? null,
      domador:          payload.domador ?? null,
    }
    if (payload.categoria !== 'Yegua') {
      update.prenada      = false
      update.fecha_prenez = null
    } else if ('prenada' in payload) {
      update.prenada      = payload.prenada ?? false
      update.fecha_prenez = payload.prenada ? (payload.fecha_prenez ?? null) : null
    }
    const { error } = await supabase.from('caballo').update(update).eq('id', id)
    if (error) throw error
  },

  async editarMasivo(
    ids: string[],
    cambios: { campo_id?: string | null; categoria?: string; rol_reproductivo?: string | null; prenada?: boolean | null }
  ): Promise<void> {
    const supabase = getSupabaseClient()
    const update: Record<string, unknown> = {}
    if ('campo_id' in cambios)         update.campo_id         = cambios.campo_id ?? null
    if (cambios.categoria)             update.categoria        = cambios.categoria
    if ('rol_reproductivo' in cambios) update.rol_reproductivo = cambios.rol_reproductivo ?? null
    if ('prenada' in cambios) {
      update.prenada = cambios.prenada ?? false
      // Al desmarcar se limpia la fecha. Al marcar se respeta la que ya tenga
      // cada yegua: la edición masiva no pide una fecha común. Antes se asignaba
      // `undefined`, que supabase-js descarta al serializar — el mismo efecto,
      // pero por accidente.
      if (!cambios.prenada) update.fecha_prenez = null
    }
    // Mismo criterio que `actualizar`: lo que no es Yegua no puede quedar preñado.
    if (cambios.categoria && cambios.categoria !== 'Yegua') {
      update.prenada      = false
      update.fecha_prenez = null
    }
    const { error } = await supabase.from('caballo').update(update).in('id', ids)
    if (error) throw error
  },

  async actualizarComoVet(id: string, payload: ActualizarCaballoPayload): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase.rpc('actualizar_caballo_veterinario', {
      p_caballo_id:       id,
      p_nombre:           payload.nombre,
      p_fecha_nacimiento: payload.fecha_nacimiento,
      p_categoria:        payload.categoria,
      p_subcategoria:     payload.rol_reproductivo ?? null,
      p_raza_id:          payload.raza_id,
      p_pelaje_id:        payload.pelaje_id,
      p_numero_chip:      payload.numero_chip     ?? null,
      p_numero_registro:  payload.numero_registro ?? null,
      p_padre_id:         payload.padre_id        ?? null,
      p_padre_nombre:     payload.padre_nombre    ?? null,
      p_madre_id:         payload.madre_id        ?? null,
      p_madre_nombre:     payload.madre_nombre    ?? null,
      p_campo_id:         payload.campo_id        ?? null,
      p_sexo:             resolverSexo(payload.categoria, payload.sexo),
      p_observaciones:    payload.observaciones   ?? null,
      p_domador:          payload.domador         ?? null,
    })
    if (error) throw error
  },

  async darDeBaja(id: string): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('caballo')
      .update({ activo: false })
      .eq('id', id)
    if (error) throw error
  },

  /** Toggle preñada — admins usan update directo; vets usan RPC SECURITY DEFINER */
  async togglePrenada(id: string, prenada: boolean, fechaPrenez: string | null, esVet: boolean): Promise<void> {
    const supabase = getSupabaseClient()
    if (esVet) {
      const { error } = await supabase.rpc('toggle_prenada_veterinario', {
        p_caballo_id:   id,
        p_prenada:      prenada,
        p_fecha_prenez: fechaPrenez ?? null,
      })
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('caballo')
        .update({
          prenada,
          fecha_prenez: prenada ? (fechaPrenez ?? null) : null,
          updated_at:   new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    }
  },

  async importarMasivo(
    payloads: BulkCaballoPayload[],
    sociedadId: string,
  ): Promise<{ insertados: number; errores: { index: number; message: string }[]; omitidos: number }> {
    // Filtro anti-duplicados: se omite un caballo si ya existe uno activo con el
    // mismo RP (numero_registro); si no tiene RP, se compara por nombre. También
    // deduplica dentro del propio Excel.
    const filtrarNuevos = (
      existentesRp: Set<string>,
      existentesNombreSinRp: Set<string>,
    ): { nuevos: BulkCaballoPayload[]; omitidos: number } => {
      let omitidos = 0
      const rpBatch = new Set<string>()
      const nombreBatch = new Set<string>()
      const nuevos = payloads.filter((p) => {
        const rp  = p.numero_registro?.trim().toLowerCase()
        const nom = p.nombre.trim().toLowerCase()
        const dup = rp
          ? (existentesRp.has(rp) || rpBatch.has(rp))
          : (existentesNombreSinRp.has(nom) || nombreBatch.has(nom))
        if (dup) { omitidos++; return false }
        if (rp) rpBatch.add(rp)
        else nombreBatch.add(nom)
        return true
      })
      return { nuevos, omitidos }
    }

    const supabase = getSupabaseClient()

    // Traer los existentes activos de la sociedad para el chequeo de duplicados
    const { data: existentes } = await supabase
      .from('caballo')
      .select('nombre, numero_registro')
      .eq('sociedad_id', sociedadId)
      .eq('activo', true)
    const rpExist = new Set<string>()
    const nomExist = new Set<string>()
    for (const e of (existentes ?? []) as { nombre: string; numero_registro: string | null }[]) {
      const rp = e.numero_registro?.trim().toLowerCase()
      if (rp) rpExist.add(rp)
      else nomExist.add(e.nombre.trim().toLowerCase())
    }
    const { nuevos, omitidos } = filtrarNuevos(rpExist, nomExist)
    if (nuevos.length === 0) return { insertados: 0, errores: [], omitidos }

    const rows = nuevos.map((p) => ({
      nombre:           p.nombre,
      fecha_nacimiento: p.fecha_nacimiento,
      categoria:        p.categoria,
      rol_reproductivo: p.rol_reproductivo ?? null,
      raza_id:          p.raza_id,
      pelaje_id:        p.pelaje_id,
      numero_chip:      p.numero_chip      ?? null,
      numero_registro:  p.numero_registro  ?? null,
      sociedad_id:      sociedadId,
      campo_id:         p.campo_id         ?? null,
      padre_nombre:     p.padre_nombre     ?? null,
      madre_nombre:     p.madre_nombre     ?? null,
      domador:          p.domador          ?? null,
    }))

    const { error: bulkError } = await supabase.from('caballo').insert(rows)
    if (!bulkError) return { insertados: rows.length, errores: [], omitidos }

    // Fallback: inserción individual para aislar errores
    let insertados = 0
    const errores: { index: number; message: string }[] = []
    for (let i = 0; i < rows.length; i++) {
      const { error } = await supabase.from('caballo').insert(rows[i])
      if (error) errores.push({ index: i + 1, message: error.message })
      else insertados++
    }
    return { insertados, errores, omitidos }
  },
}
