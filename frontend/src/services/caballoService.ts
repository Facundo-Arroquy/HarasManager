import { getSupabaseClient } from '../lib/supabase'
import { isMockMode, getMockUserId } from '../dev/mockMode'
import { getMockUser } from '../dev/mockUsers'
import { MOCK_SOCIEDAD } from '../dev/mockUsers'
import { MOCK_CABALLOS, MOCK_ACCESOS_VET, MOCK_RAZAS, MOCK_PELAJES, MOCK_SOCIEDADES } from '../dev/mockData'

// Lookup de nombre de empresa por sociedad_id (mock)
function getEmpresaNombre(sociedadId: string): string {
  if (sociedadId === MOCK_SOCIEDAD.id) return MOCK_SOCIEDAD.nombre
  return MOCK_SOCIEDADES.find((s) => s.id === sociedadId)?.nombre ?? 'Empresa desconocida'
}

export type Subcategoria = 'Donante' | 'Receptora'

export interface Caballo {
  id: string
  nombre: string
  fecha_nacimiento: string
  categoria: string
  subcategoria?: string | null
  raza_id: number
  pelaje_id: number
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
}

export interface ActualizarCaballoPayload {
  nombre: string
  fecha_nacimiento: string
  categoria: 'Caballo' | 'Yegua' | 'Padrillo' | 'Potrillo'
  subcategoria?: Subcategoria | null
  raza_id: number
  pelaje_id: number
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
  fecha_nacimiento: string
  categoria: 'Caballo' | 'Yegua' | 'Padrillo' | 'Potrillo'
  subcategoria?: Subcategoria | null
  raza_id: number
  pelaje_id: number
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
  async listarDelVeterinario(vetId: string) {
    if (isMockMode()) {
      const accesos = MOCK_ACCESOS_VET.filter((a) => a.vet_id === vetId && a.activo)
      const ids     = new Set(accesos.map((a) => a.caballo_id))
      return MOCK_CABALLOS
        .filter((c) => c.activo && ids.has(c.id))
        .map((c) => ({
          ...c,
          empresa_id:     c.sociedad_id,
          empresa_nombre: getEmpresaNombre(c.sociedad_id),
        }))
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('get_caballos_veterinario')
    if (error) throw error
    return (data ?? []).map((c: any) => ({
      ...c,
      cat_raza:  c.raza_nombre   ? { nombre: c.raza_nombre }   : null,
      cat_pelaje: c.pelaje_nombre ? { nombre: c.pelaje_nombre } : null,
      campo:      c.campo_nombre  ? { nombre: c.campo_nombre }  : null,
    }))
  },

  async listar(sociedadId: string) {
    if (isMockMode()) {
      const mockUser = getMockUser(getMockUserId())
      let all = MOCK_CABALLOS.filter((c) => c.sociedad_id === sociedadId && c.activo)

      if (mockUser.rol === 'veterinario') {
        all = all.filter((c) =>
          MOCK_ACCESOS_VET.some(
            (a) => a.vet_id === mockUser.id && a.activo && a.caballo_id === c.id
          )
        )
      }

      return all
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('caballo')
      .select(`
        id, nombre, fecha_nacimiento, categoria, campo_id,
        raza_id, pelaje_id, numero_chip, numero_registro, activo,
        padre_id, padre_nombre, madre_id, madre_nombre,
        cat_raza(nombre),
        cat_pelaje(nombre),
        campo(nombre)
      `)
      .eq('sociedad_id', sociedadId)
      .eq('activo', true)
      .order('nombre')
    if (error) throw error
    return data as any
  },

  async obtener(id: string) {
    if (isMockMode()) {
      const caballo = MOCK_CABALLOS.find((c) => c.id === id)
      if (!caballo) throw new Error('Caballo no encontrado')
      return caballo
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('caballo')
      .select(`
        id, nombre, fecha_nacimiento, categoria,
        numero_chip, numero_registro, activo, sociedad_id,
        cat_raza(id, nombre),
        cat_pelaje(id, nombre)
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
    // El RPC no soporta padre/madre — actualizamos si hay datos genealógicos
    const tieneGenealogia = payload.padre_id || payload.padre_nombre || payload.madre_id || payload.madre_nombre
    if (tieneGenealogia) {
      await supabase.from('caballo').update({
        padre_id:     payload.padre_id    ?? null,
        padre_nombre: payload.padre_nombre ?? null,
        madre_id:     payload.madre_id    ?? null,
        madre_nombre: payload.madre_nombre ?? null,
      }).eq('id', nuevoId)
    }

    return { id: nuevoId }
  },

  async crear(payload: NuevoCaballoPayload, sociedadId: string) {
    if (isMockMode()) {
      const { MOCK_CAMPOS } = await import('../dev/mockData')
      const raza   = MOCK_RAZAS.find((r) => r.id === payload.raza_id)
      const pelaje = MOCK_PELAJES.find((p) => p.id === payload.pelaje_id)
      const campo  = payload.campo_id ? MOCK_CAMPOS.find((c) => c.id === payload.campo_id) : null
      const nuevo = {
        id: `cab-${Date.now()}`,
        nombre: payload.nombre,
        fecha_nacimiento: payload.fecha_nacimiento,
        categoria: payload.categoria,
        subcategoria: payload.subcategoria ?? null,
        raza_id: payload.raza_id,
        pelaje_id: payload.pelaje_id,
        numero_chip: payload.numero_chip ?? '',
        numero_registro: payload.numero_registro ?? '',
        sociedad_id: sociedadId,
        campo_id: payload.campo_id ?? null,
        activo: true,
        cat_raza:  raza   ? { nombre: raza.nombre }   : null,
        cat_pelaje: pelaje ? { nombre: pelaje.nombre } : null,
        campo: campo ? { nombre: campo.nombre } : null,
      }
      MOCK_CABALLOS.push(nuevo)
      return nuevo
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('caballo')
      .insert({
        nombre:           payload.nombre,
        fecha_nacimiento: payload.fecha_nacimiento,
        categoria:        payload.categoria,
        subcategoria:     payload.subcategoria ?? null,
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
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async actualizar(id: string, payload: ActualizarCaballoPayload): Promise<void> {
    if (isMockMode()) {
      const { MOCK_CAMPOS } = await import('../dev/mockData')
      const caballo = MOCK_CABALLOS.find((c) => c.id === id)
      if (!caballo) return
      const raza   = MOCK_RAZAS.find((r) => r.id === payload.raza_id)
      const pelaje = MOCK_PELAJES.find((p) => p.id === payload.pelaje_id)
      const campo  = payload.campo_id ? MOCK_CAMPOS.find((c) => c.id === payload.campo_id) : null
      Object.assign(caballo, {
        nombre:           payload.nombre,
        fecha_nacimiento: payload.fecha_nacimiento,
        categoria:        payload.categoria,
        subcategoria:     payload.subcategoria ?? null,
        raza_id:          payload.raza_id,
        pelaje_id:        payload.pelaje_id,
        numero_chip:      payload.numero_chip ?? '',
        numero_registro:  payload.numero_registro ?? '',
        campo_id:         payload.campo_id ?? null,
        cat_raza:         raza   ? { nombre: raza.nombre }   : null,
        cat_pelaje:       pelaje ? { nombre: pelaje.nombre } : null,
        campo:            campo  ? { nombre: campo.nombre }  : null,
        padre_id:         payload.padre_id    ?? null,
        padre_nombre:     payload.padre_nombre ?? null,
        madre_id:         payload.madre_id    ?? null,
        madre_nombre:     payload.madre_nombre ?? null,
      })
      return
    }

    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('caballo')
      .update({
        nombre:           payload.nombre,
        fecha_nacimiento: payload.fecha_nacimiento,
        categoria:        payload.categoria,
        subcategoria:     payload.subcategoria ?? null,
        raza_id:          payload.raza_id,
        pelaje_id:        payload.pelaje_id,
        numero_chip:      payload.numero_chip ?? null,
        numero_registro:  payload.numero_registro ?? null,
        campo_id:         payload.campo_id ?? null,
        padre_id:         payload.padre_id    ?? null,
        padre_nombre:     payload.padre_nombre ?? null,
        madre_id:         payload.madre_id    ?? null,
        madre_nombre:     payload.madre_nombre ?? null,
      })
      .eq('id', id)
    if (error) throw error
  },

  async editarMasivo(
    ids: string[],
    cambios: { campo_id?: string | null; categoria?: string; subcategoria?: string | null }
  ): Promise<void> {
    if (isMockMode()) {
      const { MOCK_CAMPOS } = await import('../dev/mockData')
      for (const id of ids) {
        const caballo = MOCK_CABALLOS.find((c) => c.id === id)
        if (!caballo) continue
        if ('campo_id' in cambios) {
          const campo = cambios.campo_id
            ? MOCK_CAMPOS.find((c: any) => c.id === cambios.campo_id)
            : null
          caballo.campo_id = cambios.campo_id ?? null
          caballo.campo = campo ? { nombre: campo.nombre } : null
        }
        if (cambios.categoria)               caballo.categoria    = cambios.categoria
        if ('subcategoria' in cambios)        caballo.subcategoria = cambios.subcategoria ?? null
      }
      return
    }

    const supabase = getSupabaseClient()
    const update: Record<string, unknown> = {}
    if ('campo_id' in cambios)    update.campo_id    = cambios.campo_id ?? null
    if (cambios.categoria)        update.categoria   = cambios.categoria
    if ('subcategoria' in cambios) update.subcategoria = cambios.subcategoria ?? null
    const { error } = await supabase.from('caballo').update(update).in('id', ids)
    if (error) throw error
  },

  async actualizarComoVet(id: string, payload: ActualizarCaballoPayload): Promise<void> {
    if (isMockMode()) {
      return caballoService.actualizar(id, payload)
    }
    const supabase = getSupabaseClient()
    const { error } = await supabase.rpc('actualizar_caballo_veterinario', {
      p_caballo_id:       id,
      p_nombre:           payload.nombre,
      p_fecha_nacimiento: payload.fecha_nacimiento,
      p_categoria:        payload.categoria,
      p_subcategoria:     payload.subcategoria    ?? null,
      p_raza_id:          payload.raza_id,
      p_pelaje_id:        payload.pelaje_id,
      p_numero_chip:      payload.numero_chip     ?? null,
      p_numero_registro:  payload.numero_registro ?? null,
      p_padre_id:         payload.padre_id        ?? null,
      p_padre_nombre:     payload.padre_nombre    ?? null,
      p_madre_id:         payload.madre_id        ?? null,
      p_madre_nombre:     payload.madre_nombre    ?? null,
    })
    if (error) throw error
  },

  async darDeBaja(id: string): Promise<void> {
    if (isMockMode()) {
      const caballo = MOCK_CABALLOS.find((c) => c.id === id)
      if (caballo) caballo.activo = false
      return
    }

    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('caballo')
      .update({ activo: false })
      .eq('id', id)
    if (error) throw error
  },
}
