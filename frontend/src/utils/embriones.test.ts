import { describe, it, expect } from 'vitest'
import {
  EMPRESA_NO_VISIBLE,
  OTRA_EMPRESA_ID,
  empresaDuenia,
  filtrarPorDuenia,
  opcionesDuenia,
  seleccionVigente,
} from './embriones'

const NORTE = 'sociedad-norte'
const SUR = 'sociedad-sur'
const OCULTA = 'sociedad-oculta'
const OCULTA_2 = 'sociedad-oculta-2'

const nombres = new Map([
  [NORTE, 'Haras Norte'],
  [SUR, 'Haras Sur'],
])

const emb = (id: string, sociedad_id: string) => ({ id, sociedad_id })

describe('empresaDuenia', () => {
  it('es la empresa del embrión, con el nombre que ve el usuario', () => {
    expect(empresaDuenia(emb('e1', NORTE), nombres)).toEqual({ id: NORTE, nombre: 'Haras Norte' })
  })

  it('si el usuario no puede leer la empresa, usa un nombre genérico', () => {
    expect(empresaDuenia(emb('e1', OCULTA), nombres)).toEqual({ id: OTRA_EMPRESA_ID, nombre: EMPRESA_NO_VISIBLE })
  })

  it('con el mapa de nombres vacío (falló la consulta) no rompe', () => {
    expect(empresaDuenia(emb('e1', NORTE), new Map())).toEqual({ id: OTRA_EMPRESA_ID, nombre: EMPRESA_NO_VISIBLE })
  })
})

describe('opcionesDuenia', () => {
  it('lista cada empresa una sola vez, ordenada por nombre', () => {
    const lista = [emb('1', SUR), emb('2', NORTE), emb('3', SUR), emb('4', NORTE), emb('5', SUR)]
    expect(opcionesDuenia(lista, nombres)).toEqual([
      { id: NORTE, nombre: 'Haras Norte' },
      { id: SUR,   nombre: 'Haras Sur' },
    ])
  })

  it('ordena sin distinguir tildes ni mayúsculas', () => {
    const n = new Map([['a', 'Ñandú'], ['b', 'Árbol'], ['c', 'zeta']])
    const lista = [emb('1', 'a'), emb('2', 'b'), emb('3', 'c')]
    expect(opcionesDuenia(lista, n).map((o) => o.nombre)).toEqual(['Árbol', 'Ñandú', 'zeta'])
  })

  it('sin embriones no hay opciones', () => {
    expect(opcionesDuenia([], nombres)).toEqual([])
  })

  it('junta todas las empresas ilegibles en una sola opción, para no repetir etiquetas', () => {
    const lista = [emb('1', OCULTA), emb('2', NORTE), emb('3', OCULTA_2)]
    expect(opcionesDuenia(lista, nombres)).toEqual([
      { id: NORTE,           nombre: 'Haras Norte' },
      { id: OTRA_EMPRESA_ID, nombre: EMPRESA_NO_VISIBLE },
    ])
  })

  it('si fallaron los nombres queda una sola opción: el filtro no tiene qué ofrecer', () => {
    const lista = [emb('1', NORTE), emb('2', SUR)]
    expect(opcionesDuenia(lista, new Map())).toHaveLength(1)
  })
})

describe('filtrarPorDuenia', () => {
  const lista = [emb('1', NORTE), emb('2', SUR), emb('3', NORTE), emb('4', OCULTA)]

  it('sin selección devuelve todos', () => {
    expect(filtrarPorDuenia(lista, new Set(), nombres)).toEqual(lista)
  })

  it('deja solo los de la empresa elegida', () => {
    expect(filtrarPorDuenia(lista, new Set([NORTE]), nombres).map((e) => e.id)).toEqual(['1', '3'])
  })

  it('con varias empresas elegidas junta los de todas', () => {
    const elegidas = new Set([SUR, OTRA_EMPRESA_ID])
    expect(filtrarPorDuenia(lista, elegidas, nombres).map((e) => e.id)).toEqual(['2', '4'])
  })

  it('"Otra empresa" trae los de todas las empresas ilegibles', () => {
    const conDos = [...lista, emb('5', OCULTA_2)]
    expect(filtrarPorDuenia(conDos, new Set([OTRA_EMPRESA_ID]), nombres).map((e) => e.id)).toEqual(['4', '5'])
  })

  it('una empresa sin embriones deja la lista vacía', () => {
    expect(filtrarPorDuenia(lista, new Set(['otra']), nombres)).toEqual([])
  })

  it('conserva el resto de los campos del embrión', () => {
    const conEstado = [{ id: '1', sociedad_id: NORTE, estado: 'congelado' }]
    expect(filtrarPorDuenia(conEstado, new Set([NORTE]), nombres)[0].estado).toBe('congelado')
  })
})

describe('seleccionVigente', () => {
  it('descarta las empresas que ya no tienen embriones en la lista', () => {
    const lista = [emb('1', NORTE)]
    expect(seleccionVigente(new Set([NORTE, SUR]), lista, nombres)).toEqual(new Set([NORTE]))
  })

  it('si no queda ninguna, la selección queda vacía y el filtro deja de aplicar', () => {
    const lista = [emb('1', NORTE)]
    const vigente = seleccionVigente(new Set([SUR]), lista, nombres)
    expect(vigente.size).toBe(0)
    expect(filtrarPorDuenia(lista, vigente, nombres)).toEqual(lista)
  })

  it('conserva "Otra empresa" mientras quede algún embrión de una empresa ilegible', () => {
    const lista = [emb('1', OCULTA)]
    expect(seleccionVigente(new Set([OTRA_EMPRESA_ID]), lista, nombres)).toEqual(new Set([OTRA_EMPRESA_ID]))
  })
})
