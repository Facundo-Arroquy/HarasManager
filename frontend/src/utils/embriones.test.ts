import { describe, it, expect } from 'vitest'
import type { EstadoEmbrion } from '../types/crianza'
import {
  EMPRESA_NO_VISIBLE,
  OTRA_EMPRESA_ID,
  empresaDuenia,
  filtrarPorDuenia,
  opcionesDuenia,
  rotulosDuenia,
  seleccionVigente,
  vistaEmbriones,
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

  describe('empresas legibles con el mismo nombre', () => {
    const iguales = new Map([['id-b', 'Haras Doble'], ['id-a', 'Haras Doble'], [SUR, 'Haras Sur']])
    const lista = [emb('1', 'id-b'), emb('2', SUR), emb('3', 'id-a')]

    it('las numera para poder distinguirlas, por orden de id', () => {
      expect(opcionesDuenia(lista, iguales)).toEqual([
        { id: 'id-a', nombre: 'Haras Doble (1)' },
        { id: 'id-b', nombre: 'Haras Doble (2)' },
        { id: SUR,    nombre: 'Haras Sur' },
      ])
    })

    it('la numeración no depende del orden en que llegan los embriones', () => {
      const alReves = [...lista].reverse()
      expect(opcionesDuenia(alReves, iguales)).toEqual(opcionesDuenia(lista, iguales))
    })

    it('no toca los nombres que no se repiten', () => {
      const sinRepetir = opcionesDuenia([emb('1', NORTE), emb('2', SUR)], nombres)
      expect(sinRepetir.map((o) => o.nombre)).toEqual(['Haras Norte', 'Haras Sur'])
    })
  })
})

describe('rotulosDuenia', () => {
  it('da el rótulo de cada empresa tal como lo ofrece el filtro', () => {
    const iguales = new Map([['a', 'Haras Doble'], ['b', 'Haras Doble']])
    const rotulos = rotulosDuenia(opcionesDuenia([emb('1', 'a'), emb('2', 'b')], iguales))
    expect(rotulos.get('a')).toBe('Haras Doble (1)')
    expect(rotulos.get('b')).toBe('Haras Doble (2)')
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
  const opciones = (ids: string[]) => ids.map((id) => ({ id, nombre: id }))

  it('descarta las empresas que ya no están entre las opciones', () => {
    expect(seleccionVigente(new Set([NORTE, SUR]), opciones([NORTE]))).toEqual(new Set([NORTE]))
  })

  it('si no queda ninguna, la selección queda vacía y el filtro deja de aplicar', () => {
    const lista = [emb('1', NORTE)]
    const vigente = seleccionVigente(new Set([SUR]), opcionesDuenia(lista, nombres))
    expect(vigente.size).toBe(0)
    expect(filtrarPorDuenia(lista, vigente, nombres)).toEqual(lista)
  })

  it('conserva "Otra empresa" mientras quede algún embrión de una empresa ilegible', () => {
    const opts = opcionesDuenia([emb('1', OCULTA)], nombres)
    expect(seleccionVigente(new Set([OTRA_EMPRESA_ID]), opts)).toEqual(new Set([OTRA_EMPRESA_ID]))
  })
})

describe('vistaEmbriones', () => {
  const e = (id: string, sociedad_id: string, estado: EstadoEmbrion) => ({ id, sociedad_id, estado })
  const lista = [
    e('1', NORTE, 'disponible'),
    e('2', NORTE, 'congelado'),
    e('3', NORTE, 'transferido'),
    e('4', SUR,   'disponible'),
    e('5', SUR,   'en_nube'),
    e('6', OCULTA, 'descartado'),
  ]
  const sinEmpresa = new Set<string>()

  it('sin filtros muestra todo y cuenta todo', () => {
    const v = vistaEmbriones(lista, nombres, sinEmpresa, 'todos')
    expect(v.visibles).toHaveLength(6)
    expect(v.deLaEmpresa).toHaveLength(6)
    expect(v.counts).toEqual({ disponible: 2, congelado: 1, transferido: 1, en_nube: 1, descartado: 1 })
  })

  it('el filtro de empresa acota también los contadores, no solo la tabla', () => {
    const v = vistaEmbriones(lista, nombres, new Set([NORTE]), 'todos')
    expect(v.visibles.map((x) => x.id)).toEqual(['1', '2', '3'])
    expect(v.deLaEmpresa).toHaveLength(3)
    expect(v.counts).toEqual({ disponible: 1, congelado: 1, transferido: 1 })
  })

  it('el chip de estado acota la tabla pero no los contadores', () => {
    const v = vistaEmbriones(lista, nombres, new Set([NORTE]), 'disponible')
    expect(v.visibles.map((x) => x.id)).toEqual(['1'])
    expect(v.deLaEmpresa).toHaveLength(3)
    expect(v.counts.congelado).toBe(1)
  })

  it('empresa y estado sin coincidencias dejan la tabla vacía con la empresa todavía contada', () => {
    const v = vistaEmbriones(lista, nombres, new Set([NORTE]), 'en_nube')
    expect(v.visibles).toEqual([])
    expect(v.deLaEmpresa).toHaveLength(3)
    expect(v.counts.en_nube).toBeUndefined()
  })

  it('con varias empresas suma los embriones de todas', () => {
    const v = vistaEmbriones(lista, nombres, new Set([NORTE, SUR]), 'disponible')
    expect(v.visibles.map((x) => x.id)).toEqual(['1', '4'])
    expect(v.deLaEmpresa).toHaveLength(5)
  })

  it('una lista vacía da una vista vacía', () => {
    expect(vistaEmbriones([], nombres, sinEmpresa, 'todos')).toEqual({ deLaEmpresa: [], visibles: [], counts: {} })
  })
})
