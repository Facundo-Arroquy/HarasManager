/**
 * Qué dominios usan la API y cuáles siguen hablando directo con Supabase.
 *
 * La migración al backend es gradual (docs/PLAN-MIGRACION-BACKEND.md): un flag por dominio, así
 * cada uno se enciende y se apaga solo. **Apagado es el camino de hoy**, así que no tocar
 * nada deja la app exactamente como está.
 *
 *   VITE_API_URL=http://127.0.0.1:8000        sin esto, ningún dominio usa la API
 *   VITE_API_DOMINIOS=catalogos,campos        dominios que van por la API (`*` = todos)
 */

/** Los dominios del plan, uno por área del front. Un dominio nuevo se agrega acá. */
export const DOMINIOS = [
  'catalogos',
  'perfil',
  'modulos',
  'empresas',
  'campos',
  'tags',
  'caballos',
  'historial',
  'sanidad',
  'centro-cria',
  'torneos',
  'alertas',
  'notificaciones',
  'admin',
  'superadmin',
  'usuarios',
  'storage',
  'pagos',
] as const

export type Dominio = (typeof DOMINIOS)[number]

export interface ConfigApi {
  /** URL base sin barra final, o null si la API no está configurada. */
  baseUrl: string | null
  dominios: ReadonlySet<Dominio>
  /** Nombres de `VITE_API_DOMINIOS` que no son un dominio: casi seguro un error de tipeo. */
  desconocidos: string[]
  /** Hay dominios pedidos pero falta `VITE_API_URL`: no se enciende ninguno. */
  faltaUrl: boolean
}

function esDominio(nombre: string): nombre is Dominio {
  return (DOMINIOS as readonly string[]).includes(nombre)
}

export function leerConfigApi(env: { VITE_API_URL?: string; VITE_API_DOMINIOS?: string }): ConfigApi {
  const baseUrl = env.VITE_API_URL?.trim().replace(/\/+$/, '') || null
  const pedidos = (env.VITE_API_DOMINIOS ?? '').split(',').map((d) => d.trim()).filter(Boolean)
  const todos = pedidos.includes('*')

  const desconocidos = pedidos.filter((d) => d !== '*' && !esDominio(d))
  const habilitados: readonly Dominio[] = todos ? DOMINIOS : pedidos.filter(esDominio)

  return {
    baseUrl,
    dominios: new Set(baseUrl ? habilitados : []),
    desconocidos,
    faltaUrl: !baseUrl && pedidos.length > 0,
  }
}

export const CONFIG_API: ConfigApi = leerConfigApi(import.meta.env)

if (import.meta.env.DEV) {
  if (CONFIG_API.desconocidos.length > 0) {
    console.warn(`[api] VITE_API_DOMINIOS tiene nombres que no son un dominio: ${CONFIG_API.desconocidos.join(', ')}`)
  }
  if (CONFIG_API.faltaUrl) {
    console.warn('[api] VITE_API_DOMINIOS está definido pero falta VITE_API_URL: todos los dominios siguen en Supabase.')
  }
}

/** ¿Este dominio va por la API? Si no, va por Supabase directo, como hasta ahora. */
export function usaApi(dominio: Dominio, config: ConfigApi = CONFIG_API): boolean {
  return config.dominios.has(dominio)
}
