import createClient, { type Client } from 'openapi-fetch'
import { getSupabaseClient } from '../lib/supabase'
import { ErrorApi, errorDesdeRespuesta } from './errores'
import { CONFIG_API } from './flags'
import type { paths } from './schema'

/** Cliente tipado de la API: las rutas, los parámetros y las respuestas salen de `schema.d.ts`. */
export type ClienteApi = Client<paths>

export interface OpcionesCliente {
  baseUrl: string
  /** Token de la sesión de Supabase, o null si no hay sesión. */
  obtenerToken: () => Promise<string | null>
  /** Pide un token nuevo. Se usa una sola vez cuando la API responde `token_vencido`. */
  renovarToken?: () => Promise<string | null>
  /** Cómo se envía el pedido. Por defecto `fetch`; los tests pasan uno simulado. */
  fetch?: (pedido: Request) => Promise<Response>
}

async function esTokenVencido(respuesta: Response): Promise<boolean> {
  try {
    return ((await respuesta.clone().json()) as { code?: unknown }).code === 'token_vencido'
  } catch {
    return false
  }
}

export function crearClienteApi(opciones: OpcionesCliente): ClienteApi {
  const enviar = opciones.fetch ?? ((pedido: Request) => globalThis.fetch(pedido))

  async function conToken(pedido: Request, token: string | null): Promise<Response> {
    if (token) pedido.headers.set('Authorization', `Bearer ${token}`)
    return enviar(pedido)
  }

  async function conSesion(pedido: Request): Promise<Response> {
    const copia = pedido.clone() // el cuerpo se lee una sola vez: hay que guardar uno para reintentar
    const respuesta = await conToken(pedido, await opciones.obtenerToken())

    // Supabase renueva el token solo, pero entre que se lee y llega a la API puede vencer.
    if (respuesta.status === 401 && opciones.renovarToken && (await esTokenVencido(respuesta))) {
      const nuevo = await opciones.renovarToken()
      if (nuevo) return conToken(copia, nuevo)
    }
    return respuesta
  }

  return createClient<paths>({ baseUrl: opciones.baseUrl, fetch: conSesion })
}

let cliente: ClienteApi | null = null

/** El cliente de la app: usa la sesión de Supabase para autenticarse. Falla si la API no está configurada. */
export function getApi(): ClienteApi {
  if (cliente) return cliente
  if (!CONFIG_API.baseUrl) {
    throw new Error('La API no está configurada: falta VITE_API_URL.')
  }
  const supabase = getSupabaseClient()
  cliente = crearClienteApi({
    baseUrl: CONFIG_API.baseUrl,
    obtenerToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
    renovarToken: async () => (await supabase.auth.refreshSession()).data.session?.access_token ?? null,
  })
  return cliente
}

/**
 * Lleva el resultado de una llamada del cliente a "devuelve los datos o lanza un `ErrorApi`",
 * que es lo que hacen los services de hoy con Supabase (`if (error) throw error`):
 *
 *   const perfil = await desenvolver(getApi().GET('/me'))
 */
export async function desenvolver<D>(
  pedido: Promise<{ data?: D; error?: unknown; response: Response }>,
): Promise<D> {
  let resultado: { data?: D; error?: unknown; response: Response }
  try {
    resultado = await pedido
  } catch (e) {
    if (e instanceof ErrorApi) throw e
    throw new ErrorApi(0, 'sin_conexion', 'No se pudo conectar con el servidor.')
  }
  if (resultado.response.ok) return resultado.data as D
  throw errorDesdeRespuesta(resultado.response.status, resultado.error)
}
