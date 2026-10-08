import { describe, it, expect, beforeEach, vi } from 'vitest'
import { sumarDias } from './fecha'
import { PLAZOS_VET_DEFAULTS } from '../types/crianza'
import type { NuevoRegistroCriaPayload, RecordatorioCria } from '../types/crianza'
import {
  cambiosCircuitoPorRegistro, MOTIVO_NUEVA_IN, MOTIVO_OVULADA,
  MOTIVO_NO_REINSEMINAR, MOTIVO_CIRCUITO_NO_REINSEMINAR,
} from './circuitoOvulacion'
import { accionParaRecordatorio, actoResuelveRecordatorio } from './recordatorio'

vi.mock('../services/crianzaService', () => ({
  crianzaService: {
    crearRegistro:                      vi.fn(),
    crearRecordatoriosBatch:            vi.fn().mockResolvedValue([]),
    cancelarRecordatorios:              vi.fn().mockResolvedValue(undefined),
    huboInseminacionEntre:              vi.fn().mockResolvedValue(true),
    listarRecordatoriosAbiertosDelDia:  vi.fn().mockResolvedValue([]),
    listarRecordatoriosAbiertosDeTipos: vi.fn().mockResolvedValue([]),
    marcarRecordatoriosHechos:          vi.fn().mockResolvedValue(undefined),
  },
}))

const { crianzaService } = await import('../services/crianzaService')
const { useCrianzaStore, reglasParaRegistro } = await import('../store/crianzaStore')

/** Día 0 del circuito: la IN. */
const D0 = '2026-10-05'
const dia = (n: number) => sumarDias(D0, n)

type Registro = Pick<NuevoRegistroCriaPayload,
  'fecha' | 'obs_chips' | 'ovario_izq' | 'ovario_der' | 'review_dias' | 'fecha_flushing_programada'>

function registro(fecha: string, chips: string[] = [], ov = false): Registro {
  return {
    fecha, obs_chips: chips, ovario_izq: ov ? ['OV'] : [], ovario_der: [],
    review_dias: null, fecha_flushing_programada: null,
  }
}

function rec(id: string, tipo: string, fecha_vto: string): RecordatorioCria {
  return {
    id, caballo_id: 'estrella', sociedad_id: 'soc-1', tipo, fecha_vto, estado: 'pendiente',
    veterinario_id: 'vet-1', notas: null, auto_generado: true, origen_registro_id: 'reg-in',
    cancel_motivo: null, created_at: '', updated_at: '',
  }
}

/** Tipo → fecha de lo que agenda el registro. */
function agenda(r: Registro, chequeosAbiertos: string[] = []): Record<string, string> {
  return Object.fromEntries(
    reglasParaRegistro(r, 'Donante', PLAZOS_VET_DEFAULTS, true, [], chequeosAbiertos)
      .map((x) => [x.tipo, x.calcularFecha(r.fecha)]),
  )
}

describe('circuito post-IN — lo que agenda cada registro', () => {
  it('IN → día 1 Dar OXI, día 2 Chequear ovulación + Reinseminar', () => {
    expect(agenda(registro(D0, ['IN']))).toEqual({
      OXI: dia(1),
      'Chequear ovulación': dia(2),
      Reinseminar: dia(2),
    })
  })

  it('cada IN arranca un circuito nuevo, aunque haya uno abierto', () => {
    expect(agenda(registro(dia(2), ['IN']), [dia(2)])).toEqual({
      OXI: dia(3),
      'Chequear ovulación': dia(4),
      Reinseminar: dia(4),
    })
  })

  it('IN con OV en el mismo registro no abre circuito (ya ovuló)', () => {
    const a = agenda(registro(D0, ['IN'], true))
    expect(a['Chequear ovulación']).toBeUndefined()
    expect(a.Reinseminar).toBeUndefined()
  })

  it('chequeo sin OV: vuelve a chequear al día siguiente, sin nuevo Reinseminar', () => {
    expect(agenda(registro(dia(2)), [dia(2)])).toEqual({ 'Chequear ovulación': dia(3) })
  })

  it('chequeo con atraso (agendado ayer) también continúa el circuito', () => {
    expect(agenda(registro(dia(3)), [dia(2)])).toEqual({ 'Chequear ovulación': dia(4) })
  })

  it('OV cierra el circuito: no se agenda otro chequeo (sí el Flushing)', () => {
    const a = agenda(registro(dia(2), [], true), [dia(2)])
    expect(a['Chequear ovulación']).toBeUndefined()
    expect(a.Flushing).toBeDefined()
  })

  it('el registro de OXI (día 1) no duplica el chequeo ya agendado para el día 2', () => {
    expect(agenda(registro(dia(1), ['OXI']), [dia(2)])).toEqual({})
  })

  it('sin circuito abierto, un registro cualquiera no agenda chequeos', () => {
    expect(agenda(registro(dia(2)))).toEqual({})
  })
})

describe('circuito post-IN — qué le hace un registro a lo abierto', () => {
  const abiertos = [rec('chq', 'Chequear ovulación', dia(2)), rec('rein', 'Reinseminar', dia(2))]

  it('chequeo sin OV: el chequeo queda hecho y Reinseminar sigue esperando la decisión', () => {
    expect(cambiosCircuitoPorRegistro(registro(dia(2)), abiertos))
      .toEqual({ hechos: ['chq'], cancelados: [], motivo: null })
  })

  it('OV: el chequeo queda hecho y Reinseminar se cancela (fin del circuito)', () => {
    expect(cambiosCircuitoPorRegistro(registro(dia(2), [], true), abiertos))
      .toEqual({ hechos: ['chq'], cancelados: ['rein'], motivo: MOTIVO_OVULADA })
  })

  it('reinseminación: la IN cierra Reinseminar y el chequeo como hechos', () => {
    expect(cambiosCircuitoPorRegistro(registro(dia(2), ['IN']), abiertos))
      .toEqual({ hechos: ['chq', 'rein'], cancelados: [], motivo: null })
  })

  it('IN antes de las 48 h: lo pendiente del circuito anterior se cancela', () => {
    expect(cambiosCircuitoPorRegistro(registro(dia(1), ['IN']), abiertos))
      .toEqual({ hechos: [], cancelados: ['chq', 'rein'], motivo: MOTIVO_NUEVA_IN })
  })

  it('el control del día 1 (OXI) no toca el chequeo del día 2', () => {
    expect(cambiosCircuitoPorRegistro(registro(dia(1), ['OXI']), abiertos))
      .toEqual({ hechos: [], cancelados: [], motivo: null })
  })
})

describe('circuito post-IN — recordatorios en la UI', () => {
  it('Reinseminar abre la decisión del vet, no un registro directo', () => {
    expect(accionParaRecordatorio(rec('rein', 'Reinseminar', dia(2)), []).modal).toBe('reinseminar')
  })

  it('cualquier registro hace el chequeo; Reinseminar solo lo cierra una IN', () => {
    expect(actoResuelveRecordatorio('Chequear ovulación', { clase: 'registro', chips: [] })).toBe(true)
    expect(actoResuelveRecordatorio('Reinseminar', { clase: 'registro', chips: [] })).toBe(false)
    expect(actoResuelveRecordatorio('Reinseminar', { clase: 'registro', chips: ['IN'] })).toBe(true)
  })
})

describe('circuito post-IN — store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCrianzaStore.setState({
      registros: [], recordatorios: [], flushings: [], transferencias: [], ecografias: [],
      plazos: PLAZOS_VET_DEFAULTS, reglasPropias: [], loading: false, error: null,
    })
  })

  function payload(fecha: string, chips: string[] = [], ov = false): NuevoRegistroCriaPayload {
    return {
      ...registro(fecha, chips, ov),
      caballo_id: 'estrella', sociedad_id: 'soc-1', veterinario_id: 'vet-1', utero: [],
      padrillo_id: null, ov_dias: null, review_desc: null, motivo: null, diagnostico: null,
      tratamiento: null, observaciones: null, origen_recordatorio_id: null,
    }
  }

  it('chequeo sin OV: cierra el chequeo y agenda el de mañana colgado del registro', async () => {
    const chq = rec('chq', 'Chequear ovulación', dia(2))
    useCrianzaStore.setState({ recordatorios: [chq] })
    vi.mocked(crianzaService.listarRecordatoriosAbiertosDeTipos).mockResolvedValue([chq])
    vi.mocked(crianzaService.crearRegistro).mockResolvedValue({ id: 'reg-chq' } as never)

    await useCrianzaStore.getState().crearRegistro(payload(dia(2)), 'Donante')

    expect(crianzaService.marcarRecordatoriosHechos).toHaveBeenCalledWith(['chq'])
    expect(crianzaService.cancelarRecordatorios).not.toHaveBeenCalled()
    expect(crianzaService.crearRecordatoriosBatch).toHaveBeenCalledWith([
      expect.objectContaining({ tipo: 'Chequear ovulación', fecha_vto: dia(3) }),
    ])
    expect(useCrianzaStore.getState().recordatorios.find((r) => r.id === 'chq')?.estado).toBe('hecho')
  })

  it('OV: cancela lo que quedaba abierto del circuito', async () => {
    const abiertos = [rec('chq', 'Chequear ovulación', dia(3)), rec('rein', 'Reinseminar', dia(2))]
    useCrianzaStore.setState({ recordatorios: abiertos })
    vi.mocked(crianzaService.listarRecordatoriosAbiertosDeTipos).mockResolvedValue(abiertos)
    vi.mocked(crianzaService.crearRegistro).mockResolvedValue({ id: 'reg-ov' } as never)

    await useCrianzaStore.getState().crearRegistro(payload(dia(3), [], true), 'Donante')

    expect(crianzaService.cancelarRecordatorios).toHaveBeenCalledWith(['rein'], MOTIVO_OVULADA)
    const tipos = vi.mocked(crianzaService.crearRecordatoriosBatch).mock.calls[0][0].map((r) => r.tipo)
    expect(tipos).not.toContain('Chequear ovulación')
  })

  it('No reinseminar: cancela Reinseminar y cierra los chequeos del circuito', async () => {
    const rein = rec('rein', 'Reinseminar', dia(2))
    const chq  = rec('chq', 'Chequear ovulación', dia(3))
    useCrianzaStore.setState({ recordatorios: [rein, chq] })
    vi.mocked(crianzaService.listarRecordatoriosAbiertosDeTipos).mockResolvedValue([rein, chq])

    await useCrianzaStore.getState().decidirNoReinseminar(rein)

    expect(crianzaService.cancelarRecordatorios).toHaveBeenCalledWith(['rein'], MOTIVO_NO_REINSEMINAR)
    expect(crianzaService.cancelarRecordatorios).toHaveBeenCalledWith(['chq'], MOTIVO_CIRCUITO_NO_REINSEMINAR)
    expect(crianzaService.crearRecordatoriosBatch).not.toHaveBeenCalled()
    expect(useCrianzaStore.getState().recordatorios.every((r) => r.estado === 'cancelado')).toBe(true)
  })
})
