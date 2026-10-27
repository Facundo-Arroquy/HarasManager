import { describe, it, expect } from 'vitest'
import { DOMINIOS, leerConfigApi, usaApi } from './flags'

describe('leerConfigApi', () => {
  it('sin nada configurado, ningún dominio usa la API (el comportamiento de hoy)', () => {
    const config = leerConfigApi({})
    expect(config.baseUrl).toBeNull()
    expect(config.dominios.size).toBe(0)
    expect(DOMINIOS.some((d) => usaApi(d, config))).toBe(false)
  })

  it('enciende solo los dominios nombrados', () => {
    const config = leerConfigApi({ VITE_API_URL: 'http://127.0.0.1:8000', VITE_API_DOMINIOS: 'catalogos, campos' })
    expect(usaApi('catalogos', config)).toBe(true)
    expect(usaApi('campos', config)).toBe(true)
    expect(usaApi('caballos', config)).toBe(false)
  })

  it('`*` enciende todos', () => {
    const config = leerConfigApi({ VITE_API_URL: 'http://127.0.0.1:8000', VITE_API_DOMINIOS: '*' })
    expect(DOMINIOS.every((d) => usaApi(d, config))).toBe(true)
  })

  it('sin VITE_API_URL no se enciende nada aunque haya dominios pedidos, y se avisa', () => {
    const config = leerConfigApi({ VITE_API_DOMINIOS: 'catalogos' })
    expect(usaApi('catalogos', config)).toBe(false)
    expect(config.faltaUrl).toBe(true)
  })

  it('detecta los nombres que no son un dominio (errores de tipeo) y no los enciende', () => {
    const config = leerConfigApi({ VITE_API_URL: 'http://x', VITE_API_DOMINIOS: 'catalogo,campos' })
    expect(config.desconocidos).toEqual(['catalogo'])
    expect(usaApi('catalogos', config)).toBe(false)
    expect(usaApi('campos', config)).toBe(true)
  })

  it('saca la barra final de la URL y los espacios', () => {
    expect(leerConfigApi({ VITE_API_URL: ' http://127.0.0.1:8000/// ' }).baseUrl).toBe('http://127.0.0.1:8000')
  })

  it('ignora los elementos vacíos de la lista', () => {
    const config = leerConfigApi({ VITE_API_URL: 'http://x', VITE_API_DOMINIOS: ',catalogos,, ,' })
    expect([...config.dominios]).toEqual(['catalogos'])
    expect(config.desconocidos).toEqual([])
  })
})
