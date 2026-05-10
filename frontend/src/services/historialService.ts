import { getSupabaseClient } from '../lib/supabase'
import { isMockMode } from '../dev/mockMode'
import { MOCK_HISTORIAL } from '../dev/mockData'

export interface NuevaConsultaPayload {
  caballoId: string
  tipoConsultaId: number
  fechaConsulta: string        // ISO string
  diagnostico?: string
  tratamiento?: string
  observaciones?: string
  proximaConsulta?: string     // fecha YYYY-MM-DD
  creadoPor: string            // usuario.id
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

export const historialService = {
  async listarPorCaballo(caballoId: string) {
    if (isMockMode()) {
      const entries = (MOCK_HISTORIAL[caballoId] ?? []) as object[]
      // Ordenar DESC por fecha_consulta
      return [...entries].sort((a, b) => {
        const fa = (a as { fecha_consulta: string }).fecha_consulta
        const fb = (b as { fecha_consulta: string }).fecha_consulta
        return new Date(fb).getTime() - new Date(fa).getTime()
      })
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('historial_clinico')
      .select(`
        id, fecha_consulta, diagnostico, tratamiento,
        observaciones, proxima_consulta, created_at,
        cat_tipo_consulta(nombre),
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

  async crear(payload: NuevaConsultaPayload) {
    if (isMockMode()) {
      // Construir entrada mock compatible con HistorialCard
      const { MOCK_TIPOS_CONSULTA } = await import('../dev/mockData')
      const tipo = MOCK_TIPOS_CONSULTA.find((t) => t.id === payload.tipoConsultaId)

      const partes = payload.partesAfectadas.map((p, i) => ({
        id: `hpa-mock-${Date.now()}-${i}`,
        lado: p.lado,
        descripcion: p.descripcion ?? null,
        cat_parte_cuerpo: { nombre: `Parte ${p.parteCuerpoId}` }, // nombre real viene de catalogoService
      }))

      const meds = payload.medicamentos.map((m, i) => ({
        id: `hm-mock-${Date.now()}-${i}`,
        medicamento: m.medicamento,
        dosis: m.dosis ?? null,
        via_administracion: m.viaAdministracion ?? null,
        duracion_dias: m.duracionDias ?? null,
      }))

      const nuevaEntrada = {
        id: `hc-mock-${Date.now()}`,
        caballo_id: payload.caballoId,
        fecha_consulta: payload.fechaConsulta,
        diagnostico: payload.diagnostico ?? null,
        tratamiento: payload.tratamiento ?? null,
        observaciones: payload.observaciones ?? null,
        proxima_consulta: payload.proximaConsulta ?? null,
        creado_por: payload.creadoPor,
        cat_tipo_consulta: { nombre: tipo?.nombre ?? 'Consulta' },
        usuario: { nombre: 'Dra. Valentina', apellido: 'Ríos' },
        historial_parte_afectada: partes,
        historial_medicamento: meds,
      }

      if (!MOCK_HISTORIAL[payload.caballoId]) {
        MOCK_HISTORIAL[payload.caballoId] = []
      }
      MOCK_HISTORIAL[payload.caballoId].unshift(nuevaEntrada)
      return nuevaEntrada
    }

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
