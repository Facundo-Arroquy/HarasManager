import { getSupabaseClient } from '../lib/supabase'
import { isMockMode, getMockUserId } from '../dev/mockMode'
import { getMockUser } from '../dev/mockUsers'
import { MOCK_CABALLOS, MOCK_ACCESOS_VET, MOCK_RAZAS, MOCK_PELAJES, MOCK_MARCAS } from '../dev/mockData'

export interface NuevoCaballoPayload {
  nombre: string
  fecha_nacimiento: string
  categoria: 'Caballo' | 'Yegua' | 'Padrillo' | 'Potrillo'
  raza_id: number
  pelaje_id: number
  numero_chip?: string
  numero_registro?: string
  marca_id: string
  campo_id?: string | null
}

export interface TransferirPayload {
  marca_nueva_id: string
  fecha_transferencia: string
  observaciones?: string
}

export const caballoService = {
  async listar(sociedadId: string) {
    if (isMockMode()) {
      const mockUser = getMockUser(getMockUserId())
      let all = MOCK_CABALLOS.filter((c) => c.sociedad_id === sociedadId && c.activo)

      if (mockUser.rol === 'veterinario') {
        // Solo caballos con acceso explícito concedido
        all = all.filter((c) =>
          MOCK_ACCESOS_VET.some(
            (a) =>
              a.vet_id === mockUser.id &&
              a.activo &&
              (a.marca_id === c.marca_id || a.caballo_id === c.id)
          )
        )
      } else if (mockUser.marcaId) {
        // Admin marca / jugador / peticero → solo su marca
        all = all.filter((c) => c.marca_id === mockUser.marcaId)
      }
      // marcaId === null y rol admin → admin haras, ve todo

      return all
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('caballo')
      .select(`
        id, nombre, fecha_nacimiento, categoria, marca_id, campo_id,
        numero_chip, numero_registro, activo,
        cat_raza(nombre),
        cat_pelaje(nombre),
        marca(nombre),
        campo(nombre)
      `)
      .eq('sociedad_id', sociedadId)
      .eq('activo', true)
      .order('nombre')
    if (error) throw error
    return data
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
        id, nombre, fecha_nacimiento, categoria, marca_id,
        numero_chip, numero_registro, activo, sociedad_id,
        cat_raza(id, nombre),
        cat_pelaje(id, nombre),
        marca(nombre)
      `)
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  async crear(payload: NuevoCaballoPayload, sociedadId: string) {
    if (isMockMode()) {
      const { MOCK_CAMPOS } = await import('../dev/mockData')
      const raza   = MOCK_RAZAS.find((r) => r.id === payload.raza_id)
      const pelaje = MOCK_PELAJES.find((p) => p.id === payload.pelaje_id)
      const marca  = MOCK_MARCAS.find((m) => m.id === payload.marca_id)
      const campo  = payload.campo_id ? MOCK_CAMPOS.find((c) => c.id === payload.campo_id) : null
      const nuevo = {
        id: `cab-${Date.now()}`,
        nombre: payload.nombre,
        fecha_nacimiento: payload.fecha_nacimiento,
        categoria: payload.categoria,
        raza_id: payload.raza_id,
        pelaje_id: payload.pelaje_id,
        numero_chip: payload.numero_chip ?? '',
        numero_registro: payload.numero_registro ?? '',
        sociedad_id: sociedadId,
        marca_id: payload.marca_id,
        campo_id: payload.campo_id ?? null,
        activo: true,
        cat_raza:  raza   ? { nombre: raza.nombre }   : null,
        cat_pelaje: pelaje ? { nombre: pelaje.nombre } : null,
        marca: marca ? { nombre: marca.nombre, dominio_email: marca.dominio_email } : null,
        campo: campo ? { nombre: campo.nombre } : null,
      }
      MOCK_CABALLOS.push(nuevo)
      return nuevo
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('caballo')
      .insert({
        nombre: payload.nombre,
        fecha_nacimiento: payload.fecha_nacimiento,
        categoria: payload.categoria,
        raza_id: payload.raza_id,
        pelaje_id: payload.pelaje_id,
        numero_chip: payload.numero_chip,
        numero_registro: payload.numero_registro,
        sociedad_id: sociedadId,
        marca_id: payload.marca_id,
        campo_id: payload.campo_id ?? null,
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async transferir(
    caballoId: string,
    payload: TransferirPayload,
    registradoPor: string
  ) {
    if (isMockMode()) {
      const caballo = MOCK_CABALLOS.find((c) => c.id === caballoId)
      if (!caballo) throw new Error('Caballo no encontrado')
      const nuevaMarca = MOCK_MARCAS.find((m) => m.id === payload.marca_nueva_id)
      caballo.marca_id = payload.marca_nueva_id
      caballo.marca = nuevaMarca
        ? { nombre: nuevaMarca.nombre, dominio_email: nuevaMarca.dominio_email }
        : null
      return
    }

    const supabase = getSupabaseClient()

    // 1. Obtener marca actual para el historial
    const { data: cab } = await supabase
      .from('caballo')
      .select('marca_id')
      .eq('id', caballoId)
      .single()

    // 2. Actualizar marca del caballo
    const { error: e1 } = await supabase
      .from('caballo')
      .update({ marca_id: payload.marca_nueva_id })
      .eq('id', caballoId)
    if (e1) throw e1

    // 3. Registrar en historial_propiedad
    const { error: e2 } = await supabase.from('historial_propiedad').insert({
      caballo_id: caballoId,
      marca_anterior_id: cab?.marca_id ?? null,
      marca_nueva_id: payload.marca_nueva_id,
      fecha_transferencia: payload.fecha_transferencia,
      registrado_por: registradoPor,
      observaciones: payload.observaciones ?? null,
    })
    if (e2) throw e2
  },
}
