import { describe, it, expect } from 'vitest'
import { armarTarjetas, type Evento } from './programaSemanal'
import { actoResuelveRecordatorio, type ActoCria } from './recordatorio'
import type { RecordatorioCria } from '../types/crianza'

const DIA = '2026-10-07'

function rec(id: string, tipo: string, estado: RecordatorioCria['estado'] = 'pendiente'): RecordatorioCria {
  return {
    id, caballo_id: 'estrella', sociedad_id: 'soc-1', tipo, fecha_vto: DIA, estado,
    veterinario_id: null, notas: null, auto_generado: true, origen_registro_id: null,
    cancel_motivo: null, created_at: '', updated_at: '',
  }
}

function base(id: string): Pick<Evento, 'id' | 'fecha' | 'caballoId' | 'caballoNombre' | 'rol' | 'empresa' | 'campo' | 'veterinario' | 'detalle'> {
  return {
    id, fecha: DIA, caballoId: 'estrella', caballoNombre: 'Estrella', rol: 'Donante',
    empresa: 'Haras', campo: 'Campo', veterinario: null, detalle: null,
  }
}

function agendado(r: RecordatorioCria): Evento {
  const porHacer = r.estado === 'pendiente' || r.estado === 'vencido'
  return {
    ...base(`rec-${r.id}`), actividad: r.tipo, etiqueta: r.tipo,
    tipo: porHacer ? 'pendiente' : r.tipo === 'Flushing' ? 'flushing' : 'registro',
    ...(porHacer ? { recordatorio: r } : { recordatorioHecho: r }),
  }
}

function registro(id: string, chips: string[] = []): Evento {
  const etiqueta = chips.length ? chips.join(', ') : 'Revisión'
  return { ...base(`reg-${id}`), actividad: etiqueta, etiqueta, tipo: 'registro', acto: { clase: 'registro', chips } }
}

function flushing(id: string): Evento {
  return { ...base(`flu-${id}`), actividad: 'Flushing', etiqueta: 'Flushing: 3 embriones', tipo: 'flushing', acto: { clase: 'flushing' } }
}

describe('actoResuelveRecordatorio', () => {
  it.each<[string, ActoCria, boolean]>([
    ['Revisión',     { clase: 'registro', chips: [] },      true],
    ['Revisión PG',  { clase: 'registro', chips: [] },      true],
    ['Revisión Eco', { clase: 'registro', chips: [] },      false],
    ['IN',           { clase: 'registro', chips: [] },      false],
    ['IN',           { clase: 'registro', chips: ['IN'] },  true],
    ['Dar PG',       { clase: 'registro', chips: ['PG'] },  true],
    ['Flushing',     { clase: 'flushing' },                 true],
    ['Revisión PG',  { clase: 'flushing' },                 false],
    ['Eco 2',        { clase: 'ecografia', numero: 2 },     true],
    ['Eco 2',        { clase: 'ecografia', numero: 1 },     false],
  ])('%s ← %j: %s', (tipo, acto, esperado) => {
    expect(actoResuelveRecordatorio(tipo, acto)).toBe(esperado)
  })
})

describe('armarTarjetas — una yegua, un cartel por día', () => {
  it('dos actividades pendientes van en el mismo cartel', () => {
    const tarjetas = armarTarjetas([agendado(rec('1', 'Flushing')), agendado(rec('2', 'Revisión PG'))])
    expect(tarjetas).toHaveLength(1)
    expect(tarjetas[0].etiqueta).toBe('Flushing | Revisión PG')
    expect(tarjetas[0].estado).toBe('pendiente')
  })

  it('hecha una de las dos, la otra sigue por hacer en el mismo cartel', () => {
    const tarjetas = armarTarjetas([
      agendado(rec('1', 'Flushing', 'hecho')), agendado(rec('2', 'Revisión PG')), flushing('f'),
    ])
    expect(tarjetas).toHaveLength(1)
    expect(tarjetas[0].etiqueta).toBe('Revisión PG | Flushing: 3 embriones ✓')
    expect(tarjetas[0].estado).toBe('pendiente')
  })

  it('hechas las dos queda Registrado, con el nombre de lo agendado', () => {
    const tarjetas = armarTarjetas([
      agendado(rec('1', 'Flushing', 'hecho')), agendado(rec('2', 'Revisión PG', 'hecho')),
      flushing('f'), registro('r'),
    ])
    expect(tarjetas).toHaveLength(1)
    expect(tarjetas[0].etiqueta).toBe('Flushing: 3 embriones ✓ | Revisión PG ✓')
    expect(tarjetas[0].estado).toBe('registro')
  })

  it('nunca Falta hacer al lado del Registrado que lo resolvió', () => {
    // Datos viejos: la consulta se cargó y el recordatorio quedó abierto.
    const tarjetas = armarTarjetas([agendado(rec('1', 'Revisión')), registro('r', ['IN'])])
    expect(tarjetas).toHaveLength(1)
    expect(tarjetas[0].actividades).toHaveLength(1)
    expect(tarjetas[0].etiqueta).toBe('Revisión, IN ✓')
    expect(tarjetas[0].estado).toBe('registro')
  })

  it('otra yegua u otro día son otro cartel', () => {
    const otra = { ...agendado(rec('2', 'IN')), caballoId: 'luna' }
    const otroDia = { ...agendado(rec('3', 'IN')), fecha: '2026-10-08' }
    expect(armarTarjetas([agendado(rec('1', 'IN')), otra, otroDia])).toHaveLength(3)
  })
})
