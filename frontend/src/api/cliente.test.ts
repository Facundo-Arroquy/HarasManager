import { describe, it, expect, vi } from 'vitest'
import { crearClienteApi, desenvolver } from './cliente'
import { ErrorApi } from './errores'
import { esLimiteCaballosVet, esLimiteMembresiaVet, mensajeError } from '../utils/error'

const PERFIL = { id: 'u1', email: 'a@haras.com', nombre: 'A', apellido: 'B', rol: 'admin', activo: true, membresias: [] }

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
}

function crear(fetchSimulado: (r: Request) => Promise<Response>, extras = {}) {
  return crearClienteApi({
    baseUrl: 'http://api.test',
    obtenerToken: () => Promise.resolve('token-1'),
    fetch: fetchSimulado,
    ...extras,
  })
}

describe('crearClienteApi', () => {
  it('manda el token de la sesión en Authorization', async () => {
    const enviado = vi.fn((_r: Request) => Promise.resolve(json(PERFIL)))

    await crear(enviado).GET('/me')

    const pedido = enviado.mock.calls[0][0]
    expect(pedido.url).toBe('http://api.test/me')
    expect(pedido.headers.get('Authorization')).toBe('Bearer token-1')
  })

  it('sin sesión no manda Authorization (y la API responde 401)', async () => {
    const enviado = vi.fn((_r: Request) => Promise.resolve(json({ code: 'no_autenticado', message: 'x' }, 401)))

    await crear(enviado, { obtenerToken: () => Promise.resolve(null) }).GET('/me')

    expect(enviado.mock.calls[0][0].headers.has('Authorization')).toBe(false)
  })

  it('si el token venció, lo renueva y reintenta una sola vez', async () => {
    const enviado = vi
      .fn<(r: Request) => Promise<Response>>()
      .mockResolvedValueOnce(json({ code: 'token_vencido', message: 'venció' }, 401))
      .mockResolvedValueOnce(json(PERFIL))
    const renovar = vi.fn(() => Promise.resolve('token-2'))

    const { data } = await crear(enviado, { renovarToken: renovar }).GET('/me')

    expect(data?.email).toBe('a@haras.com')
    expect(renovar).toHaveBeenCalledTimes(1)
    expect(enviado).toHaveBeenCalledTimes(2)
    expect(enviado.mock.calls[1][0].headers.get('Authorization')).toBe('Bearer token-2')
  })

  it('un 401 por token inválido no se reintenta', async () => {
    const enviado = vi.fn((_r: Request) => Promise.resolve(json({ code: 'token_invalido', message: 'x' }, 401)))
    const renovar = vi.fn(() => Promise.resolve('token-2'))

    await crear(enviado, { renovarToken: renovar }).GET('/me')

    expect(renovar).not.toHaveBeenCalled()
    expect(enviado).toHaveBeenCalledTimes(1)
  })

  it('si el reintento también falla, devuelve ese error y no sigue insistiendo', async () => {
    const enviado = vi.fn((_r: Request) => Promise.resolve(json({ code: 'token_vencido', message: 'venció' }, 401)))

    const { response } = await crear(enviado, { renovarToken: () => Promise.resolve('token-2') }).GET('/me')

    expect(response.status).toBe(401)
    expect(enviado).toHaveBeenCalledTimes(2)
  })
})

describe('desenvolver', () => {
  it('devuelve los datos de una respuesta exitosa', async () => {
    const perfil = await desenvolver(crear(() => Promise.resolve(json(PERFIL))).GET('/me'))
    expect(perfil.id).toBe('u1')
  })

  it('lanza un ErrorApi con el code y el message de la API', async () => {
    const pedido = crear(() => Promise.resolve(json({ code: 'usuario_inactivo', message: 'Tu usuario está desactivado.' }, 403))).GET('/me')

    const error = await desenvolver(pedido).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ErrorApi)
    expect(error).toMatchObject({ status: 403, code: 'usuario_inactivo', message: 'Tu usuario está desactivado.' })
  })

  it('los códigos HM001 y HM002 llegan como `code`: utils/error.ts los reconoce sin cambios', async () => {
    const limite = (code: string, status: number) =>
      desenvolver(crear(() => Promise.resolve(json({ code, message: 'Alcanzaste el límite.' }, status))).GET('/me'))
        .catch((e: unknown) => e)

    const gratuito = await limite('HM001', 402)
    const membresia = await limite('HM002', 403)

    expect(esLimiteCaballosVet(gratuito)).toBe(true)
    expect(esLimiteMembresiaVet(gratuito)).toBe(false)
    expect(esLimiteMembresiaVet(membresia)).toBe(true)
    expect(mensajeError(gratuito)).toBe('Alcanzaste el límite.')
  })

  it('un error sin la forma esperada se vuelve un error genérico, sin romper', async () => {
    const pedido = crear(() => Promise.resolve(new Response('<html>502</html>', { status: 502 }))).GET('/me')

    const error = await desenvolver(pedido).catch((e: unknown) => e)

    expect(error).toMatchObject({ status: 502, code: 'error_desconocido' })
  })

  it('si no hay conexión con la API, lanza un ErrorApi de estado 0', async () => {
    const pedido = crear(() => Promise.reject(new TypeError('Failed to fetch'))).GET('/me')

    const error = await desenvolver(pedido).catch((e: unknown) => e)

    expect(error).toMatchObject({ status: 0, code: 'sin_conexion' })
  })
})
