import { describe, it, expect, vi } from 'vitest'
import { traerTodo } from './paginar'

/** Simula una tabla de `total` filas que, como PostgREST, devuelve a lo sumo `maxRows` por pedido. */
function tabla(total: number, maxRows = 1000) {
  const filas = Array.from({ length: total }, (_, i) => ({ id: i }))
  return vi.fn((desde: number, hasta: number) =>
    Promise.resolve({ data: filas.slice(desde, Math.min(hasta + 1, desde + maxRows)), error: null }))
}

describe('traerTodo', () => {
  it('trae todas las filas cuando la tabla pasa el tope de la API (el bug del programa semanal)', async () => {
    const pedir = tabla(1133)
    const filas = await traerTodo(pedir)
    expect(filas).toHaveLength(1133)
    expect(filas[0].id).toBe(0)
    expect(filas[1132].id).toBe(1132)
    expect(pedir.mock.calls).toEqual([[0, 999], [1000, 1999]])
  })

  it('con una tabla chica pide una sola página', async () => {
    const pedir = tabla(35)
    expect(await traerTodo(pedir)).toHaveLength(35)
    expect(pedir).toHaveBeenCalledTimes(1)
  })

  it('con una tabla vacía devuelve []', async () => {
    expect(await traerTodo(tabla(0))).toEqual([])
  })

  it('cuando el total es múltiplo exacto de la página, termina con una página vacía', async () => {
    const pedir = tabla(2000)
    expect(await traerTodo(pedir)).toHaveLength(2000)
    expect(pedir.mock.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it('no repite ni saltea filas entre páginas', async () => {
    const filas = await traerTodo(tabla(2500))
    expect(filas.map((f) => f.id)).toEqual(Array.from({ length: 2500 }, (_, i) => i))
  })

  it('respeta un tamaño de página propio', async () => {
    const pedir = tabla(25)
    expect(await traerTodo(pedir, 10)).toHaveLength(25)
    expect(pedir.mock.calls).toEqual([[0, 9], [10, 19], [20, 29]])
  })

  it('trata data null como página vacía', async () => {
    const pedir = vi.fn().mockResolvedValue({ data: null, error: null })
    expect(await traerTodo(pedir)).toEqual([])
  })

  it('propaga el error de una página y no devuelve una lista parcial', async () => {
    const falla = new Error('boom')
    const pedir = vi.fn()
      .mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, i) => ({ id: i })), error: null })
      .mockResolvedValueOnce({ data: null, error: falla })
    await expect(traerTodo(pedir)).rejects.toBe(falla)
  })
})
