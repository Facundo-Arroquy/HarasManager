import { getSupabaseClient } from '../lib/supabase'
import { nombreCaballo } from '../utils/caballo'

export interface NuevaConsultaPayload {
  caballoId: string
  tipoConsultaId: number
  fechaConsulta: string        // ISO string
  diagnostico?: string
  tratamiento?: string
  observaciones?: string
  proximaConsulta?: string     // fecha YYYY-MM-DD
  creadoPor: string            // usuario.id
  /** 'pendiente' = consulta agendada, todavía sin hacer. Por defecto 'realizada'. */
  estado?: EstadoConsulta
  /** Lo hizo un profesional de afuera: se carga solo para dejar constancia. */
  trabajoExterno?: boolean
  imagenUrl?: string
  partesAfectadas: Array<{
    parteCuerpoId: number
    lado: string
    descripcion?: string
  }>
  medicamentos: Array<{
    medicamento: string
    dosis?: string
    viaAdministracion?: string
    duracionDias?: number
  }>
}

interface HistorialResumen {
  id: string
  fecha_consulta: string
  proxima_consulta: string | null
  caballo_id: string
  caballo_nombre: string
  tipo: string
  diagnostico: string | null
}

export type EstadoConsulta = 'pendiente' | 'realizada'

/** Consulta agendada o ya hecha, como la muestra el calendario. */
export interface ConsultaCalendario {
  id:             string
  fecha_consulta: string        // TIMESTAMPTZ
  estado:         EstadoConsulta
  caballo_id:     string
  caballo_nombre: string
  /** Empresa dueña del caballo. El vet la usa para saber de dónde viene. */
  sociedad_id:    string | null
  tipo:           string
  diagnostico:    string | null
  veterinario:    string | null
  creado_por:     string
}

/** Una consulta ya hecha, como la lista la sección "Trabajos realizados". */
export interface TrabajoRealizado {
  id:              string
  fecha_consulta:  string
  caballo_id:      string
  caballo_nombre:  string
  tipo:            string
  diagnostico:     string | null
  tratamiento:     string | null
  veterinario:     string | null
  trabajo_externo: boolean
}

export interface AlertaVet {
  historial_id: string
  proxima_consulta: string
  caballo_id: string
  caballo_nombre: string
  tipo: string | null
  dias_restantes: number
}

export const historialService = {
  async subirImagenConsulta(caballoId: string, file: File): Promise<string> {
    const supabase = getSupabaseClient()
    const ext = file.name.split('.').pop()
    const path = `consultas/${caballoId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('caballos').upload(path, file, { upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from('caballos').getPublicUrl(path)
    return data.publicUrl
  },

  async listarRecientesVet(limit = 5): Promise<HistorialResumen[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('get_consultas_recientes_vet', { p_limit: limit })
    if (error) throw error
    return (data ?? []).map((h: {
      id: string; fecha_consulta: string; proxima_consulta?: string | null
      caballo_id: string; caballo_nombre?: string | null; tipo?: string | null; diagnostico?: string | null
    }) => ({
      id:               h.id,
      fecha_consulta:   h.fecha_consulta,
      proxima_consulta: h.proxima_consulta ?? null,
      caballo_id:       h.caballo_id,
      caballo_nombre:   h.caballo_nombre ?? '—',
      tipo:             h.tipo ?? 'Consulta',
      diagnostico:      h.diagnostico ?? null,
    }))
  },

  async listarAlertasVet(): Promise<AlertaVet[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('get_alertas_vet')
    if (error) throw error
    return (data ?? []) as AlertaVet[]
  },

  async listarRecientesTodos(sociedadId: string, limit = 8): Promise<HistorialResumen[]> {
    const supabase = getSupabaseClient()
    // RLS restringe por sociedad; el filtro explicit es por si acaso
    const { data, error } = await supabase
      .from('historial_clinico')
      .select(`
        id, fecha_consulta, proxima_consulta, diagnostico, caballo_id,
        caballo!inner(nombre, sociedad_id),
        cat_tipo_consulta(nombre)
      `)
      .eq('caballo.sociedad_id', sociedadId)
      .order('fecha_consulta', { ascending: false })
      .limit(limit)
    if (error) throw error

    return ((data ?? []) as unknown as {
      id: string; fecha_consulta: string; proxima_consulta?: string | null; caballo_id: string
      caballo?: { nombre?: string } | null; cat_tipo_consulta?: { nombre?: string } | null; diagnostico?: string | null
    }[]).map((h) => ({
      id:               h.id,
      fecha_consulta:   h.fecha_consulta,
      proxima_consulta: h.proxima_consulta ?? null,
      caballo_id:       h.caballo_id,
      caballo_nombre:   h.caballo?.nombre ?? '—',
      tipo:             h.cat_tipo_consulta?.nombre ?? 'Consulta',
      diagnostico:      h.diagnostico ?? null,
    }))
  },

  /**
   * Consultas ya cargadas dentro de un rango de días, para el calendario. El
   * rango se pide con un día de margen a cada lado porque `fecha_consulta` es
   * TIMESTAMPTZ y el corte por día se hace después en hora argentina.
   * Sin `sociedadId` (veterinario) el filtrado queda en manos de la RLS.
   */
  async listarPorRango(
    desde: string, hasta: string, sociedadId?: string,
  ): Promise<ConsultaCalendario[]> {
    const supabase = getSupabaseClient()
    let query = supabase
      .from('historial_clinico')
      .select(`
        id, fecha_consulta, estado, diagnostico, caballo_id, creado_por,
        caballo!inner(nombre, numero_registro, sociedad_id),
        cat_tipo_consulta(nombre),
        usuario!creado_por(nombre, apellido)
      `)
      .gte('fecha_consulta', `${desde}T00:00:00`)
      .lte('fecha_consulta', `${hasta}T23:59:59`)
      .order('fecha_consulta', { ascending: true })
    if (sociedadId) query = query.eq('caballo.sociedad_id', sociedadId)

    const { data, error } = await query
    if (error) throw error

    return ((data ?? []) as unknown as {
      id: string; fecha_consulta: string; estado: EstadoConsulta
      diagnostico: string | null; caballo_id: string; creado_por: string
      caballo?: { nombre?: string | null; numero_registro?: string | null; sociedad_id?: string | null } | null
      cat_tipo_consulta?: { nombre?: string } | null
      usuario?: { nombre?: string; apellido?: string } | null
    }[]).map((h) => ({
      id:             h.id,
      fecha_consulta: h.fecha_consulta,
      estado:         h.estado,
      caballo_id:     h.caballo_id,
      caballo_nombre: nombreCaballo(h.caballo ?? {}),
      sociedad_id:    h.caballo?.sociedad_id ?? null,
      tipo:           h.cat_tipo_consulta?.nombre ?? 'Consulta',
      diagnostico:    h.diagnostico ?? null,
      veterinario:    h.usuario ? `${h.usuario.nombre ?? ''} ${h.usuario.apellido ?? ''}`.trim() : null,
      creado_por:     h.creado_por,
    }))
  },

  /**
   * Consultas ya hechas, de la más nueva a la más vieja. `externo` filtra en el
   * servidor y no sobre la lista traída: con el tope puesto, filtrar acá
   * escondería los trabajos externos viejos que quedaron fuera del corte.
   * Sin `sociedadId` (veterinario) el alcance lo decide la RLS: ve las de los
   * caballos donde tiene acceso.
   */
  async listarRealizadas(
    { sociedadId, externo, limit = 100 }: {
      sociedadId?: string
      /** `undefined` = todas; `true`/`false` = solo externas / solo propias. */
      externo?: boolean
      limit?: number
    },
  ): Promise<TrabajoRealizado[]> {
    const supabase = getSupabaseClient()
    let query = supabase
      .from('historial_clinico')
      .select(`
        id, fecha_consulta, diagnostico, tratamiento, caballo_id, trabajo_externo,
        caballo!inner(nombre, numero_registro, sociedad_id),
        cat_tipo_consulta(nombre),
        usuario!creado_por(nombre, apellido)
      `)
      .eq('estado', 'realizada')
      .order('fecha_consulta', { ascending: false })
      .limit(limit)
    if (sociedadId)         query = query.eq('caballo.sociedad_id', sociedadId)
    if (externo !== undefined) query = query.eq('trabajo_externo', externo)

    const { data, error } = await query
    if (error) throw error

    return ((data ?? []) as unknown as {
      id: string; fecha_consulta: string; diagnostico: string | null
      tratamiento: string | null; caballo_id: string; trabajo_externo: boolean | null
      caballo?: { nombre?: string | null; numero_registro?: string | null } | null
      cat_tipo_consulta?: { nombre?: string } | null
      usuario?: { nombre?: string; apellido?: string } | null
    }[]).map((h) => ({
      id:              h.id,
      fecha_consulta:  h.fecha_consulta,
      caballo_id:      h.caballo_id,
      caballo_nombre:  nombreCaballo(h.caballo ?? {}),
      tipo:            h.cat_tipo_consulta?.nombre ?? 'Consulta',
      diagnostico:     h.diagnostico ?? null,
      tratamiento:     h.tratamiento ?? null,
      veterinario:     h.usuario ? `${h.usuario.nombre ?? ''} ${h.usuario.apellido ?? ''}`.trim() : null,
      trabajo_externo: h.trabajo_externo ?? false,
    }))
  },

  /** Mueve una consulta a otra fecha y horario. Solo puede su autor (RLS). */
  async reagendar(historialId: string, fechaISO: string): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('historial_clinico')
      .update({ fecha_consulta: fechaISO })
      .eq('id', historialId)
    if (error) throw error
  },

  /**
   * Borra una consulta agendada que nunca se hizo. La RLS solo lo permite sobre
   * las `pendiente` propias: el historial ya cargado es inmutable y no se borra.
   * Partes afectadas y medicamentos se van en cascada.
   */
  async eliminar(historialId: string): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('historial_clinico').delete().eq('id', historialId)
    if (error) throw error
  },

  /** Una consulta con todo su detalle, para completarla desde el calendario. */
  async obtenerPorId(historialId: string) {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('historial_clinico')
      .select(`
        id, fecha_consulta, estado, diagnostico, tratamiento, creado_por,
        observaciones, proxima_consulta, imagen_url, caballo_id, created_at,
        trabajo_externo,
        cat_tipo_consulta(id, nombre),
        usuario!creado_por(nombre, apellido),
        historial_parte_afectada(
          id, lado, descripcion,
          cat_parte_cuerpo(nombre)
        ),
        historial_medicamento(
          id, medicamento, dosis, via_administracion, duracion_dias
        )
      `)
      .eq('id', historialId)
      .single()
    if (error) throw error
    return data
  },

  async listarPorCaballo(caballoId: string) {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('historial_clinico')
      .select(`
        id, fecha_consulta, diagnostico, tratamiento, creado_por,
        observaciones, proxima_consulta, imagen_url, created_at, trabajo_externo,
        cat_tipo_consulta(id, nombre),
        usuario!creado_por(nombre, apellido),
        historial_parte_afectada(
          id, lado, descripcion,
          cat_parte_cuerpo(nombre)
        ),
        historial_medicamento(
          id, medicamento, dosis, via_administracion, duracion_dias
        )
      `)
      .eq('caballo_id', caballoId)
      .order('fecha_consulta', { ascending: false })
    if (error) throw error
    return data
  },

  async actualizar(
    historialId: string,
    payload: Omit<NuevaConsultaPayload, 'caballoId' | 'creadoPor'>
  ): Promise<void> {
    const supabase = getSupabaseClient()
    const { error: e1 } = await supabase
      .from('historial_clinico')
      .update({
        tipo_consulta_id: payload.tipoConsultaId,
        fecha_consulta:   payload.fechaConsulta,
        diagnostico:      payload.diagnostico   ?? null,
        tratamiento:      payload.tratamiento   ?? null,
        observaciones:    payload.observaciones ?? null,
        proxima_consulta: payload.proximaConsulta ?? null,
        imagen_url:       payload.imagenUrl ?? null,
        trabajo_externo:  payload.trabajoExterno ?? false,
        // Completar una consulta agendada es guardarla con la ficha cargada.
        ...(payload.estado ? { estado: payload.estado } : {}),
      })
      .eq('id', historialId)
    if (e1) throw e1

    await supabase.from('historial_parte_afectada').delete().eq('historial_id', historialId)
    if (payload.partesAfectadas.length > 0) {
      const { error: e2 } = await supabase.from('historial_parte_afectada').insert(
        payload.partesAfectadas.map((p) => ({
          historial_id:    historialId,
          parte_cuerpo_id: p.parteCuerpoId,
          lado:            p.lado,
          descripcion:     p.descripcion ?? null,
        }))
      )
      if (e2) throw e2
    }

    await supabase.from('historial_medicamento').delete().eq('historial_id', historialId)
    if (payload.medicamentos.length > 0) {
      const { error: e3 } = await supabase.from('historial_medicamento').insert(
        payload.medicamentos.map((m) => ({
          historial_id:       historialId,
          medicamento:        m.medicamento,
          dosis:              m.dosis             ?? null,
          via_administracion: m.viaAdministracion ?? null,
          duracion_dias:      m.duracionDias       ?? null,
        }))
      )
      if (e3) throw e3
    }
  },

  async crear(payload: NuevaConsultaPayload) {
    const supabase = getSupabaseClient()

    // Insertar historial_clinico
    const { data: hc, error: hcError } = await supabase
      .from('historial_clinico')
      .insert({
        caballo_id: payload.caballoId,
        tipo_consulta_id: payload.tipoConsultaId,
        fecha_consulta: payload.fechaConsulta,
        diagnostico: payload.diagnostico,
        tratamiento: payload.tratamiento,
        observaciones: payload.observaciones,
        proxima_consulta: payload.proximaConsulta,
        creado_por: payload.creadoPor,
        imagen_url: payload.imagenUrl ?? null,
        estado: payload.estado ?? 'realizada',
        trabajo_externo: payload.trabajoExterno ?? false,
      })
      .select('id')
      .single()
    if (hcError) throw hcError

    // Insertar partes afectadas
    if (payload.partesAfectadas.length > 0) {
      const { error } = await supabase.from('historial_parte_afectada').insert(
        payload.partesAfectadas.map((p) => ({
          historial_id: hc.id,
          parte_cuerpo_id: p.parteCuerpoId,
          lado: p.lado,
          descripcion: p.descripcion,
        }))
      )
      if (error) throw error
    }

    // Insertar medicamentos
    if (payload.medicamentos.length > 0) {
      const { error } = await supabase.from('historial_medicamento').insert(
        payload.medicamentos.map((m) => ({
          historial_id: hc.id,
          medicamento: m.medicamento,
          dosis: m.dosis,
          via_administracion: m.viaAdministracion,
          duracion_dias: m.duracionDias,
        }))
      )
      if (error) throw error
    }

    return hc
  },
}
