import { describe, it, expect, beforeEach, vi } from 'vitest'
import { sumarDias } from '../utils/fecha'
import { PLAZOS_VET_DEFAULTS } from '../types/crianza'
import type { NuevoRegistroCriaPayload, RecordatorioCria } from '../types/crianza'

// `crianzaService` habla con Supabase (necesita VITE_SUPABASE_URL/ANON en
// runtime). Se mockea entero: estos tests cubren la lógica del store, no la
// capa de red.
vi.mock('../services/crianzaService', () => ({
  crianzaService: {
    crearRegistro:            vi.fn(),
    crearRecordatoriosBatch:  vi.fn(),
    cancelarRecordatorios:    vi.fn(),
    huboInseminacionEntre:    vi.fn(),
  },
}))

const { crianzaService } = await import('../services/crianzaService')
const { useCrianzaStore, reglasParaRegistro } = await import('./crianzaStore')

const FECHA_BASE = '2026-09-17'

function registroBase(reviewDias: number | null): Pick<
  NuevoRegistroCriaPayload, 'fecha' | 'obs_chips' | 'ovario_izq' | 'ovario_der' | 'review_dias'
> {
  return {
    fecha:       FECHA_BASE,
    obs_chips:   [],
    ovario_izq:  [],
    ovario_der:  [],
    review_dias: reviewDias,
  }
}

// ── reglasParaRegistro: la fecha objetivo de la revisión ───────────────────

describe('reglasParaRegistro — revisión programable a N días', () => {
  it.each([1, 7, 60])('agenda la Revisión a %s día(s) desde la fecha del registro', (dias) => {
    const reglas = reglasParaRegistro(registroBase(dias), null, PLAZOS_VET_DEFAULTS, false)
    const revision = reglas.find((r) => r.tipo === 'Revisión')
    expect(revision).toBeDefined()
    expect(revision!.calcularFecha(FECHA_BASE)).toBe(sumarDias(FECHA_BASE, dias))
  })

  it('no agenda ninguna Revisión si no se pidió (review_dias = null)', () => {
    const reglas = reglasParaRegistro(registroBase(null), null, PLAZOS_VET_DEFAULTS, false)
    expect(reglas.find((r) => r.tipo === 'Revisión')).toBeUndefined()
  })

  it('60 días cruza de mes sin desviarse (17 de septiembre → 16 de noviembre)', () => {
    const reglas = reglasParaRegistro(registroBase(60), null, PLAZOS_VET_DEFAULTS, false)
    const revision = reglas.find((r) => r.tipo === 'Revisión')!
    expect(revision.calcularFecha(FECHA_BASE)).toBe('2026-11-16')
  })
})

// ── Listado diario: agrupar por fecha_vto (mismo criterio que              ──
// ── ProgramaSemanalPage.eventosPorDia) ──────────────────────────────────────

/** Reproduce el agrupamiento de ProgramaSemanalPage: `mapa[e.fecha] ??= []`. */
function agruparPorFecha(recordatorios: Pick<RecordatorioCria, 'id' | 'fecha_vto'>[]) {
  const mapa: Record<string, typeof recordatorios> = {}
  for (const r of recordatorios) (mapa[r.fecha_vto] ??= []).push(r)
  return mapa
}

describe('Listado diario — el animal cae en el día correcto y no en otros', () => {
  it.each([1, 7, 60])('una revisión a %s día(s) solo aparece en fecha_vto = fecha + %s, no en los días vecinos', (dias) => {
    const reglas = reglasParaRegistro(registroBase(dias), null, PLAZOS_VET_DEFAULTS, false)
    const fechaVto = reglas.find((r) => r.tipo === 'Revisión')!.calcularFecha(FECHA_BASE)

    const recordatorio = { id: `rec-${dias}`, fecha_vto: fechaVto }
    const mapa = agruparPorFecha([recordatorio])

    expect(mapa[fechaVto]).toEqual([recordatorio])
    // No debe colarse en el día anterior ni en el siguiente al calculado.
    expect(mapa[sumarDias(fechaVto, -1)] ?? []).toEqual([])
    expect(mapa[sumarDias(fechaVto, 1)] ?? []).toEqual([])
  })
})

// ── crearRegistro: criterio explícito de duplicados ─────────────────────────

describe('crearRegistro — revisión duplicada para el mismo animal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCrianzaStore.setState({
      registros: [], recordatorios: [], flushings: [], transferencias: [], ecografias: [],
      plazos: PLAZOS_VET_DEFAULTS, reglasPropias: [], loading: false, error: null,
    })
  })

  it('cancela la Revisión pendiente previa del animal antes de crear la nueva', async () => {
    const caballoId = 'caballo-1'
    const previa: RecordatorioCria = {
      id: 'rec-vieja', caballo_id: caballoId, sociedad_id: 'soc-1',
      tipo: 'Revisión', fecha_vto: '2026-09-20', estado: 'pendiente',
      veterinario_id: 'vet-1', notas: null, auto_generado: true,
      origen_registro_id: 'reg-anterior', cancel_motivo: null,
      created_at: '', updated_at: '',
    }
    useCrianzaStore.setState({ recordatorios: [previa] })

    vi.mocked(crianzaService.crearRegistro).mockResolvedValue({
      id: 'reg-nuevo', caballo_id: caballoId, sociedad_id: 'soc-1',
    } as never)
    vi.mocked(crianzaService.cancelarRecordatorios).mockResolvedValue(undefined)
    vi.mocked(crianzaService.crearRecordatoriosBatch).mockResolvedValue([
      { id: 'rec-nueva', caballo_id: caballoId, tipo: 'Revisión', fecha_vto: sumarDias(FECHA_BASE, 5) } as never,
    ])

    const payload: NuevoRegistroCriaPayload = {
      caballo_id: caballoId, sociedad_id: 'soc-1', fecha: FECHA_BASE, veterinario_id: 'vet-1',
      ovario_izq: [], ovario_der: [], utero: [], obs_chips: [],
      padrillo_id: null, ov_dias: null, review_dias: 5, review_desc: null,
      motivo: null, diagnostico: null, tratamiento: null, observaciones: null,
      origen_recordatorio_id: null,
    }

    await useCrianzaStore.getState().crearRegistro(payload, null)

    // Se canceló la revisión vieja de este animal, no una de otro.
    expect(crianzaService.cancelarRecordatorios).toHaveBeenCalledWith(
      ['rec-vieja'],
      expect.any(String),
    )
    // La nueva se agenda a fecha + review_dias.
    expect(crianzaService.crearRecordatoriosBatch).toHaveBeenCalledWith([
      expect.objectContaining({ tipo: 'Revisión', fecha_vto: sumarDias(FECHA_BASE, 5) }),
    ])

    const estadoFinal = useCrianzaStore.getState().recordatorios
    expect(estadoFinal.find((r) => r.id === 'rec-vieja')?.estado).toBe('cancelado')
    expect(estadoFinal.some((r) => r.id === 'rec-nueva')).toBe(true)
  })

  it('no cancela nada si el animal no tenía una revisión pendiente previa', async () => {
    vi.mocked(crianzaService.crearRegistro).mockResolvedValue({
      id: 'reg-nuevo', caballo_id: 'caballo-2', sociedad_id: 'soc-1',
    } as never)
    vi.mocked(crianzaService.crearRecordatoriosBatch).mockResolvedValue([
      { id: 'rec-nueva', caballo_id: 'caballo-2', tipo: 'Revisión', fecha_vto: sumarDias(FECHA_BASE, 1) } as never,
    ])

    const payload: NuevoRegistroCriaPayload = {
      caballo_id: 'caballo-2', sociedad_id: 'soc-1', fecha: FECHA_BASE, veterinario_id: 'vet-1',
      ovario_izq: [], ovario_der: [], utero: [], obs_chips: [],
      padrillo_id: null, ov_dias: null, review_dias: 1, review_desc: null,
      motivo: null, diagnostico: null, tratamiento: null, observaciones: null,
      origen_recordatorio_id: null,
    }

    await useCrianzaStore.getState().crearRegistro(payload, null)

    expect(crianzaService.cancelarRecordatorios).not.toHaveBeenCalled()
  })
})
