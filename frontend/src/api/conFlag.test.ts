import { describe, it, expect, vi } from 'vitest'
import { conFlag } from './conFlag'

describe('conFlag', () => {
  const caminos = () => ({
    supabase: vi.fn((n: number) => Promise.resolve(`supabase:${n}`)),
    api: vi.fn((n: number) => Promise.resolve(`api:${n}`)),
  })

  it('con el flag apagado va por Supabase, que es el camino de hoy', async () => {
    const c = caminos()
    const llamar = conFlag('campos', c, () => false)

    expect(await llamar(7)).toBe('supabase:7')
    expect(c.supabase).toHaveBeenCalledWith(7)
    expect(c.api).not.toHaveBeenCalled()
  })

  it('con el flag prendido va por la API', async () => {
    const c = caminos()
    const llamar = conFlag('campos', c, () => true)

    expect(await llamar(7)).toBe('api:7')
    expect(c.supabase).not.toHaveBeenCalled()
  })

  it('lee el flag en cada llamada, no al crearse', async () => {
    const c = caminos()
    let prendido = false
    const llamar = conFlag('campos', c, () => prendido)

    expect(await llamar(1)).toBe('supabase:1')
    prendido = true
    expect(await llamar(2)).toBe('api:2')
  })

  it('pregunta por el dominio que corresponde', async () => {
    const usa = vi.fn(() => false)
    await conFlag('torneos', caminos(), usa)(1)
    expect(usa).toHaveBeenCalledWith('torneos')
  })

  it('un error del camino elegido llega tal cual a quien llamó', async () => {
    const llamar = conFlag(
      'campos',
      { supabase: () => Promise.reject(new Error('boom')), api: () => Promise.resolve('x') },
      () => false,
    )
    await expect(llamar()).rejects.toThrow('boom')
  })
})
