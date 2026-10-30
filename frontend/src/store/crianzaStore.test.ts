import { describe, it, expect, beforeEach, vi } from 'vitest'
import { hoyAR, sumarDias } from '../utils/fecha'
import type { NuevoRegistroCriaPayload, PlazosVet, RecordatorioCria } from '../types/crianza'

// `crianzaService` habla con Supabase (necesita VITE_SUPABASE_URL/ANON en
// runtime). Se mockea entero: estos tests cubren la lógica del store, no la
// capa de red.
vi.mock('../services/crianzaService', () => ({
  crianzaService: {
    registrarActoReproductivo: vi.fn(),
    huboInseminacionEntre:    vi.fn(),
    listarRecordatoriosAbiertosDelDia: vi.fn().mockResolvedValue([]),
    marcarRecordatoriosHechos:         vi.fn().mockResolvedValue([]),
    posponerRecordatorio:              vi.fn(),
  },
}))

const { crianzaService } = await import('../services/crianzaService')
const { useCrianzaStore, reglasParaRegistro } = await import('./crianzaStore')

const FECHA_BASE = '2026-09-17'

const TEST_PLAZOS: PlazosVet = {
  donante_strelin_a_in: 1, donante_in_a_oxi: 1, donante_ov_a_flushing: 6,
  donante_ov_sin_in_a_dar_pg: 4, donante_pg_a_revision_pg: 3,
  donante_flushing_a_revision: 4, donante_flushing_aplica_pg: true,
  receptora_pg_a_revision_pg: 4, receptora_ov_a_dar_pg: 3,
  receptora_transf_a_eco1: 30, receptora_transf_a_eco2: 60, receptora_transf_a_eco3: 90,
}

function registroBase(reviewDias: number | null): Pick<
  NuevoRegistroCriaPayload, 'fecha' | 'obs_chips' | 'ovario_izq' | 'ovario_der' | 'review_dias' | 'fecha_flushing_programada' | 'ov_dias'
> {
  return {
    fecha:       FECHA_BASE,
    obs_chips:   [],
    ovario_izq:  [],
    ovario_der:  [],
    review_dias: reviewDias,
    fecha_flushing_programada: null,
    ov_dias:     null,
  }
}

// ── reglasParaRegistro: la fecha objetivo de la revisión ───────────────────

describe('reglasParaRegistro — revisión programable a N días', () => {
  it.each([1, 7, 60])('agenda la Revisión a %s día(s) desde la fecha del registro', (dias) => {
    const reglas = reglasParaRegistro(registroBase(dias), null, TEST_PLAZOS, false)
    const revision = reglas.find((r) => r.tipo === 'Revisión')
    expect(revision).toBeDefined()
    expect(revision!.calcularFecha(FECHA_BASE)).toBe(sumarDias(FECHA_BASE, dias))
  })

  it('no agenda ninguna Revisión si no se pidió (review_dias = null)', () => {
    const reglas = reglasParaRegistro(registroBase(null), null, TEST_PLAZOS, false)
    expect(reglas.find((r) => r.tipo === 'Revisión')).toBeUndefined()
  })

  it('60 días cruza de mes sin desviarse (17 de septiembre → 16 de noviembre)', () => {
    const reglas = reglasParaRegistro(registroBase(60), null, TEST_PLAZOS, false)
    const revision = reglas.find((r) => r.tipo === 'Revisión')!
    expect(revision.calcularFecha(FECHA_BASE)).toBe('2026-11-16')
  })
})

describe('reglasParaRegistro — prioridad de acciones manuales', () => {
  it('Strelin + IN no programa otra IN y sí programa OXI', () => {
    const reglas = reglasParaRegistro({
      ...registroBase(null),
      obs_chips: ['Strelin', 'IN'],
    }, 'Donante', TEST_PLAZOS, true)

    expect(reglas.some((r) => r.tipo === 'IN')).toBe(false)
    expect(reglas.find((r) => r.tipo === 'OXI')?.calcularFecha(FECHA_BASE))
      .toBe(sumarDias(FECHA_BASE, TEST_PLAZOS.donante_in_a_oxi))
  })

  it('el chip OXI no agenda nada: el chequeo de ovulación no depende de registrar la Oxi', () => {
    const reglas = reglasParaRegistro({
      ...registroBase(null),
      obs_chips: ['OXI'],
    }, 'Donante', TEST_PLAZOS, true)

    expect(reglas).toEqual([])
  })
})

describe('reglasParaRegistro — circuito de la donante inseminada', () => {
  const conIN = (extra: Partial<ReturnType<typeof registroBase>> = {}) => ({
    ...registroBase(null),
    obs_chips: ['IN'],
    ...extra,
  })

  it('la IN agenda OXI al día siguiente y el primer chequeo de ovulación el día posterior a la Oxi', () => {
    const reglas = reglasParaRegistro(conIN(), 'Donante', TEST_PLAZOS, true)
    const fechas = Object.fromEntries(reglas.map((r) => [r.tipo, r.calcularFecha(FECHA_BASE)]))

    expect(fechas).toEqual({
      'OXI':        sumarDias(FECHA_BASE, 1),
      'Chequeo OV': sumarDias(FECHA_BASE, 2),
    })
  })

  it('el chequeo se cuenta desde la IN con el plazo IN→OXI configurado, no desde la Oxi', () => {
    const reglas = reglasParaRegistro(conIN(), 'Donante', { ...TEST_PLAZOS, donante_in_a_oxi: 3 }, true)

    expect(reglas.find((r) => r.tipo === 'OXI')!.calcularFecha(FECHA_BASE)).toBe(sumarDias(FECHA_BASE, 3))
    expect(reglas.find((r) => r.tipo === 'Chequeo OV')!.calcularFecha(FECHA_BASE)).toBe(sumarDias(FECHA_BASE, 4))
  })

  it('el chequeo es una serie diaria: el preview no le ofrece correr el fin de semana', () => {
    const reglas = reglasParaRegistro(conIN(), 'Donante', TEST_PLAZOS, true)
    const chequeo = reglas.find((r) => r.tipo === 'Chequeo OV')!

    expect(chequeo.sinAjusteFinSemana).toBe(true)
    expect(chequeo.nota).toMatch(/cada día/)
  })

  it('si el mismo registro ya trae la OV no hay chequeos: la yegua ovuló', () => {
    const reglas = reglasParaRegistro(conIN({ ovario_izq: ['OV'] }), 'Donante', TEST_PLAZOS, true)

    expect(reglas.some((r) => r.tipo === 'Chequeo OV')).toBe(false)
  })

  it('Strelin + IN: no vuelve a pedir la IN pero sí arma el circuito', () => {
    const reglas = reglasParaRegistro(conIN({ obs_chips: ['Strelin', 'IN'] }), 'Donante', TEST_PLAZOS, true)

    expect(reglas.map((r) => r.tipo)).toEqual(['OXI', 'Chequeo OV'])
  })

  it('una receptora con IN no arma el circuito de la donante', () => {
    expect(reglasParaRegistro(conIN(), 'Receptora', TEST_PLAZOS, true)).toEqual([])
  })
})

describe('reglasParaRegistro — OV y Flushing', () => {
  const conOV = (extra: Partial<ReturnType<typeof registroBase>> = {}) => ({
    ...registroBase(null),
    ovario_izq: ['OV'],
    ...extra,
  })

  it('inseminada: el Flushing es la fecha de ovulación + los días configurados', () => {
    const reglas = reglasParaRegistro(conOV(), 'Donante', TEST_PLAZOS, true)

    expect(reglas.map((r) => r.tipo)).toEqual(['Flushing'])
    expect(reglas[0].calcularFecha(FECHA_BASE)).toBe(sumarDias(FECHA_BASE, TEST_PLAZOS.donante_ov_a_flushing))
  })

  it('el intervalo sale de la configuración, no del código', () => {
    const reglas = reglasParaRegistro(conOV(), 'Donante', { ...TEST_PLAZOS, donante_ov_a_flushing: 9 }, true)

    expect(reglas[0].calcularFecha(FECHA_BASE)).toBe(sumarDias(FECHA_BASE, 9))
  })

  it('si ovuló hace N días (días post-OV) el Flushing cuenta desde la ovulación y no desde el registro', () => {
    const reglas = reglasParaRegistro(conOV({ ov_dias: 2 }), 'Donante', TEST_PLAZOS, true)

    expect(reglas[0].calcularFecha(FECHA_BASE)).toBe(sumarDias(FECHA_BASE, TEST_PLAZOS.donante_ov_a_flushing - 2))
  })

  it('la fecha de flushing elegida por el vet gana sobre el cálculo', () => {
    const reglas = reglasParaRegistro(conOV({ ov_dias: 2, fecha_flushing_programada: '2026-10-30' }), 'Donante', TEST_PLAZOS, true)

    expect(reglas[0].calcularFecha(FECHA_BASE)).toBe('2026-10-30')
  })

  it('la OV no agenda ninguna Revisión automática, ni sola ni con OXI en el mismo registro', () => {
    for (const obs_chips of [[], ['OXI']]) {
      const reglas = reglasParaRegistro(conOV({ obs_chips }), 'Donante', TEST_PLAZOS, true)

      expect(reglas.some((r) => r.tipo === 'Revisión')).toBe(false)
      expect(reglas.map((r) => r.tipo)).toEqual(['Flushing'])
    }
  })

  it('sin inseminación previa sigue siendo Dar PG', () => {
    const reglas = reglasParaRegistro(conOV(), 'Donante', TEST_PLAZOS, false)

    expect(reglas.map((r) => r.tipo)).toEqual(['Dar PG'])
  })

  it('una Revisión pedida a mano por el vet (review_dias) sí se agenda', () => {
    const reglas = reglasParaRegistro(conOV({ review_dias: 3 }), 'Donante', TEST_PLAZOS, true)

    expect(reglas.find((r) => r.tipo === 'Revisión')!.calcularFecha(FECHA_BASE)).toBe(sumarDias(FECHA_BASE, 3))
  })
})

describe('reglasParaRegistro — PG y 1PG ya no son lo mismo', () => {
  const chips = (obs_chips: string[]) => ({ ...registroBase(null), obs_chips })

  it.each(['Donante', 'Receptora'] as const)('%s: PG agenda Revisión PG con el plazo configurado', (rol) => {
    const reglas = reglasParaRegistro(chips(['PG']), rol, TEST_PLAZOS, false)
    const plazo = rol === 'Donante' ? TEST_PLAZOS.donante_pg_a_revision_pg : TEST_PLAZOS.receptora_pg_a_revision_pg

    expect(reglas.map((r) => r.tipo)).toEqual(['Revisión PG'])
    expect(reglas[0].calcularFecha(FECHA_BASE)).toBe(sumarDias(FECHA_BASE, plazo))
  })

  it.each(['Donante', 'Receptora'] as const)('%s: 1PG agenda Revisión 1PG a los días elegidos y no usa el plazo de PG', (rol) => {
    const reglas = reglasParaRegistro(chips(['1PG']), rol, TEST_PLAZOS, false, [], 5)

    expect(reglas.map((r) => r.tipo)).toEqual(['Revisión 1PG'])
    expect(reglas[0].calcularFecha(FECHA_BASE)).toBe(sumarDias(FECHA_BASE, 5))
  })

  it('PG y 1PG juntos agendan las dos revisiones, cada una con su plazo', () => {
    const reglas = reglasParaRegistro(chips(['PG', '1PG']), 'Receptora', TEST_PLAZOS, false, [], 2)
    const fechas = Object.fromEntries(reglas.map((r) => [r.tipo, r.calcularFecha(FECHA_BASE)]))

    expect(fechas).toEqual({
      'Revisión 1PG': sumarDias(FECHA_BASE, 2),
      'Revisión PG':  sumarDias(FECHA_BASE, TEST_PLAZOS.receptora_pg_a_revision_pg),
    })
  })

  it('1PG sin días elegidos no agenda nada (el modal no deja guardar así)', () => {
    expect(reglasParaRegistro(chips(['1PG']), 'Donante', TEST_PLAZOS, false)).toEqual([])
  })
})

describe('protocolo de flushing — configuración PG', () => {
  it('aplica PG automáticamente por defecto y conserva el plazo de Revisión PG', () => {
    expect(TEST_PLAZOS.donante_flushing_aplica_pg).toBe(true)
    expect(TEST_PLAZOS.donante_pg_a_revision_pg).toBe(3)
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
    const reglas = reglasParaRegistro(registroBase(dias), null, TEST_PLAZOS, false)
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
      plazos: TEST_PLAZOS, configuracion: null, reglasPropias: [], loading: false, error: null,
    })
  })

  it('cancela la Revisión pendiente previa del animal antes de crear la nueva', async () => {
    const caballoId = 'caballo-1'
    const previa: RecordatorioCria = {
      id: 'rec-vieja', caballo_id: caballoId, sociedad_id: 'soc-1',
      tipo: 'Revisión', fecha_vto: '2026-09-20', fecha_original: null, estado: 'pendiente',
      veterinario_id: 'vet-1', notas: null, auto_generado: true,
      origen_registro_id: 'reg-anterior', cancel_motivo: null,
      created_at: '', updated_at: '',
    }
    useCrianzaStore.setState({ recordatorios: [previa] })

    vi.mocked(crianzaService.registrarActoReproductivo).mockResolvedValue({
      registro: { id: 'reg-nuevo', caballo_id: caballoId, sociedad_id: 'soc-1' } as never,
      recordatorios: [
        { ...previa, estado: 'cancelado', cancel_motivo: 'Reemplazada' },
        { id: 'rec-nueva', caballo_id: caballoId, tipo: 'Revisión', fecha_vto: sumarDias(FECHA_BASE, 5) } as never,
      ],
    })

    const payload: NuevoRegistroCriaPayload = {
      caballo_id: caballoId, sociedad_id: 'soc-1', fecha: FECHA_BASE, veterinario_id: 'vet-1',
      ovario_izq: [], ovario_der: [], utero: [], obs_chips: [],
      padrillo_id: null, ov_dias: null, review_dias: 5, review_desc: null,
      motivo: null, diagnostico: null, tratamiento: null, observaciones: null,
      origen_recordatorio_id: null,
    }

    await useCrianzaStore.getState().crearRegistro(payload, 'Donante')

    // Se canceló la revisión vieja de este animal, no una de otro.
    expect(crianzaService.registrarActoReproductivo).toHaveBeenCalledWith(
      payload, 'Donante', undefined, undefined,
    )

    const estadoFinal = useCrianzaStore.getState().recordatorios
    expect(estadoFinal.find((r) => r.id === 'rec-vieja')?.estado).toBe('cancelado')
    expect(estadoFinal.some((r) => r.id === 'rec-nueva')).toBe(true)
  })

  it('no cancela nada si el animal no tenía una revisión pendiente previa', async () => {
    vi.mocked(crianzaService.registrarActoReproductivo).mockResolvedValue({
      registro: { id: 'reg-nuevo', caballo_id: 'caballo-2', sociedad_id: 'soc-1' } as never,
      recordatorios: [
        { id: 'rec-nueva', caballo_id: 'caballo-2', tipo: 'Revisión', fecha_vto: sumarDias(FECHA_BASE, 1) } as never,
      ],
    })

    const payload: NuevoRegistroCriaPayload = {
      caballo_id: 'caballo-2', sociedad_id: 'soc-1', fecha: FECHA_BASE, veterinario_id: 'vet-1',
      ovario_izq: [], ovario_der: [], utero: [], obs_chips: [],
      padrillo_id: null, ov_dias: null, review_dias: 1, review_desc: null,
      motivo: null, diagnostico: null, tratamiento: null, observaciones: null,
      origen_recordatorio_id: null,
    }

    await useCrianzaStore.getState().crearRegistro(payload, 'Donante')

    expect(crianzaService.registrarActoReproductivo).toHaveBeenCalledOnce()
  })
})

describe('crearRegistro — 1PG', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCrianzaStore.setState({
      registros: [], recordatorios: [], flushings: [], transferencias: [], ecografias: [],
      plazos: TEST_PLAZOS, configuracion: null, reglasPropias: [], loading: false, error: null,
    })
  })

  it('le pasa a la función de base los días elegidos para la Revisión 1PG', async () => {
    vi.mocked(crianzaService.registrarActoReproductivo).mockResolvedValue({
      registro: { id: 'reg-1pg' } as never,
      recordatorios: [],
    })
    const payload: NuevoRegistroCriaPayload = {
      caballo_id: 'receptora-1', sociedad_id: 'soc-1', fecha: FECHA_BASE, veterinario_id: 'vet-1',
      ovario_izq: [], ovario_der: [], utero: [], obs_chips: ['1PG'],
      padrillo_id: null, ov_dias: null, review_dias: null, review_desc: null,
      motivo: null, diagnostico: null, tratamiento: null, observaciones: null,
      origen_recordatorio_id: null,
    }

    await useCrianzaStore.getState().crearRegistro(payload, 'Receptora', undefined, 4)

    expect(crianzaService.registrarActoReproductivo).toHaveBeenCalledWith(payload, 'Receptora', undefined, 4)
  })
})

// ── crearRegistro: lo agendado para ese día queda hecho, no duplicado ───────

describe('crearRegistro — cierra lo agendado del día que la consulta resolvió', () => {
  function recordatorio(id: string, tipo: string): RecordatorioCria {
    return {
      id, caballo_id: 'estrella', sociedad_id: 'soc-1', tipo, fecha_vto: FECHA_BASE,
      fecha_original: null, estado: 'pendiente', veterinario_id: 'vet-1', notas: null, auto_generado: true,
      origen_registro_id: null, cancel_motivo: null, created_at: '', updated_at: '',
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useCrianzaStore.setState({
      registros: [], recordatorios: [], flushings: [], transferencias: [], ecografias: [],
      plazos: TEST_PLAZOS, configuracion: null, reglasPropias: [], loading: false, error: null,
    })
  })

  it('una consulta cargada sin entrar por el recordatorio cierra la Revisión PG y deja el Flushing', async () => {
    const abiertos = [recordatorio('rec-flu', 'Flushing'), recordatorio('rec-rpg', 'Revisión PG')]
    useCrianzaStore.setState({ recordatorios: abiertos })
    vi.mocked(crianzaService.registrarActoReproductivo).mockResolvedValue({
      registro: { id: 'reg-1' } as never,
      recordatorios: [{ ...abiertos[1], estado: 'hecho' }],
    })

    await useCrianzaStore.getState().crearRegistro({
      caballo_id: 'estrella', sociedad_id: 'soc-1', fecha: FECHA_BASE, veterinario_id: 'vet-1',
      ovario_izq: [], ovario_der: [], utero: [], obs_chips: [],
      padrillo_id: null, ov_dias: null, review_dias: null, review_desc: null,
      motivo: null, diagnostico: null, tratamiento: null, observaciones: null,
      origen_recordatorio_id: null,
    }, 'Donante')

    expect(crianzaService.registrarActoReproductivo).toHaveBeenCalledOnce()
    const estados = Object.fromEntries(useCrianzaStore.getState().recordatorios.map((r) => [r.id, r.estado]))
    expect(estados).toEqual({ 'rec-flu': 'pendiente', 'rec-rpg': 'hecho' })
  })
})

// ── Posponer: el estado local solo cambia si la base confirmó ───────────────

describe('posponer un recordatorio — el store no miente cuando la base no lo guardó', () => {
  const MANANA = sumarDias(hoyAR(), 1)

  function recordatorio(id: string, extra: Partial<RecordatorioCria> = {}): RecordatorioCria {
    return {
      id, caballo_id: 'donante-1', sociedad_id: 'soc-1', tipo: 'Flushing', fecha_vto: '2099-01-01',
      fecha_original: null, estado: 'pendiente', veterinario_id: 'otro-vet', notas: null,
      auto_generado: true, origen_registro_id: null, cancel_motivo: null, created_at: '', updated_at: '',
      ...extra,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useCrianzaStore.setState({ recordatorios: [recordatorio('rec-1')] })
  })

  const estadoDe = (id: string) => useCrianzaStore.getState().recordatorios.find((r) => r.id === id)!

  it('éxito: aplica lo que la base devolvió, incluida la fecha_original', async () => {
    vi.mocked(crianzaService.posponerRecordatorio).mockResolvedValue({
      fecha_vto: '2099-01-03', fecha_original: '2099-01-01', estado: 'pendiente',
    })

    await useCrianzaStore.getState().posponerRecordatorio('rec-1', 2)

    // El motivo por defecto lo arma el store; el usuario ya no viaja (lo pone la RPC con auth.uid()).
    expect(crianzaService.posponerRecordatorio).toHaveBeenCalledWith('rec-1', '2099-01-03', 'pospuesto_2d')
    expect(estadoDe('rec-1')).toMatchObject({
      fecha_vto: '2099-01-03', fecha_original: '2099-01-01', estado: 'pendiente',
    })
  })

  it('éxito: un vencido se corre desde hoy y vuelve a pendiente', async () => {
    useCrianzaStore.setState({
      recordatorios: [recordatorio('rec-1', { fecha_vto: '2020-01-01', estado: 'vencido' })],
    })
    vi.mocked(crianzaService.posponerRecordatorio).mockResolvedValue({
      fecha_vto: MANANA, fecha_original: '2020-01-01', estado: 'pendiente',
    })

    await useCrianzaStore.getState().posponerRecordatorio('rec-1')

    expect(crianzaService.posponerRecordatorio).toHaveBeenCalledWith('rec-1', MANANA, 'pospuesto_1d')
    expect(estadoDe('rec-1')).toMatchObject({ fecha_vto: MANANA, estado: 'pendiente' })
  })

  it('fallo (sin permiso): el error sube a la pantalla y el recordatorio queda como estaba', async () => {
    const antes = estadoDe('rec-1')
    vi.mocked(crianzaService.posponerRecordatorio).mockRejectedValue(
      new Error('No tenés permiso para posponer este recordatorio'),
    )

    await expect(useCrianzaStore.getState().posponerRecordatorio('rec-1', 2)).rejects.toThrow(/permiso/)

    expect(estadoDe('rec-1')).toEqual(antes)
  })

  it('a fecha: éxito aplica lo devuelto por la base', async () => {
    vi.mocked(crianzaService.posponerRecordatorio).mockResolvedValue({
      fecha_vto: MANANA, fecha_original: '2099-01-01', estado: 'pendiente',
    })

    await useCrianzaStore.getState().posponerRecordatorioAFecha('rec-1', MANANA, 'edicion_manual')

    expect(crianzaService.posponerRecordatorio).toHaveBeenCalledWith('rec-1', MANANA, 'edicion_manual')
    expect(estadoDe('rec-1')).toMatchObject({ fecha_vto: MANANA, fecha_original: '2099-01-01' })
  })

  it('a fecha: si la base rechaza, el estado local no se toca', async () => {
    const antes = estadoDe('rec-1')
    vi.mocked(crianzaService.posponerRecordatorio).mockRejectedValue(new Error('Sin permiso'))

    await expect(
      useCrianzaStore.getState().posponerRecordatorioAFecha('rec-1', MANANA),
    ).rejects.toThrow('Sin permiso')

    expect(estadoDe('rec-1')).toEqual(antes)
  })

  it('una fecha anterior a hoy se rechaza antes de tocar la base', async () => {
    await expect(
      useCrianzaStore.getState().posponerRecordatorioAFecha('rec-1', sumarDias(hoyAR(), -1)),
    ).rejects.toThrow(/anterior a hoy/)

    expect(crianzaService.posponerRecordatorio).not.toHaveBeenCalled()
  })

  it('un recordatorio que no está en la lista es un error visible, no un return silencioso', async () => {
    await expect(useCrianzaStore.getState().posponerRecordatorio('fantasma', 1)).rejects.toThrow(/ya no está en la lista/)
    await expect(useCrianzaStore.getState().posponerRecordatorioAFecha('fantasma', MANANA)).rejects.toThrow(/ya no está en la lista/)

    expect(crianzaService.posponerRecordatorio).not.toHaveBeenCalled()
  })
})

describe('cerrarRecordatoriosResueltos — solo da por hecho lo que la base confirmó', () => {
  function abierto(id: string): RecordatorioCria {
    return {
      id, caballo_id: 'donante-1', sociedad_id: 'soc-1', tipo: 'Flushing', fecha_vto: FECHA_BASE,
      fecha_original: null, estado: 'pendiente', veterinario_id: 'otro-vet', notas: null,
      auto_generado: false, origen_registro_id: null, cancel_motivo: null, created_at: '', updated_at: '',
    }
  }
  const estados = () => Object.fromEntries(useCrianzaStore.getState().recordatorios.map((r) => [r.id, r.estado]))

  beforeEach(() => {
    vi.clearAllMocks()
    useCrianzaStore.setState({ recordatorios: [abierto('rec-a'), abierto('rec-b')] })
    vi.mocked(crianzaService.listarRecordatoriosAbiertosDelDia).mockResolvedValue([abierto('rec-a'), abierto('rec-b')])
  })

  it('marca hechos únicamente los ids que devolvió la base', async () => {
    vi.mocked(crianzaService.marcarRecordatoriosHechos).mockResolvedValue(['rec-a'])

    await useCrianzaStore.getState().cerrarRecordatoriosResueltos('donante-1', FECHA_BASE, { clase: 'flushing' })

    expect(estados()).toEqual({ 'rec-a': 'hecho', 'rec-b': 'pendiente' })
  })

  it('si la base no pudo cerrar ninguno (error), la lista queda intacta', async () => {
    vi.mocked(crianzaService.marcarRecordatoriosHechos).mockRejectedValue(new Error('sin permiso'))
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})

    await useCrianzaStore.getState().cerrarRecordatoriosResueltos('donante-1', FECHA_BASE, { clase: 'flushing' })

    expect(estados()).toEqual({ 'rec-a': 'pendiente', 'rec-b': 'pendiente' })
    expect(consola).toHaveBeenCalled()
    consola.mockRestore()
  })
})
