import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getSupabaseClient } from '../../lib/supabase'
import { CONFIG_API, DOMINIOS, ErrorApi, conFlag, desenvolver, getApi, usaApi } from '../../api'
import { mensajeError } from '../../utils/error'

/**
 * Diagnóstico de la conexión con la API. Solo existe en desarrollo (App.tsx no la registra en el
 * build de producción): sirve para ver qué dominios están prendidos y para probar el cliente con
 * el token real de la sesión, sin tocar ninguna pantalla de la app.
 */

interface PerfilBasico {
  origen: 'supabase' | 'api'
  id: string
  email: string
  nombre: string
  apellido: string
  rol: string | null
}

// Demo de `conFlag`: el mismo dato por los dos caminos. Con VITE_API_DOMINIOS=perfil va por la API.
const perfilConFlag = conFlag('perfil', {
  async supabase(usuarioId: string): Promise<PerfilBasico> {
    const { data, error } = await getSupabaseClient()
      .from('usuario')
      .select('id, email, nombre, apellido, rol')
      .eq('id', usuarioId)
      .single()
    if (error) throw error
    return { origen: 'supabase', ...(data as Omit<PerfilBasico, 'origen'>) }
  },
  async api(_usuarioId: string): Promise<PerfilBasico> {
    const me = await desenvolver(getApi().GET('/me'))
    return { origen: 'api', id: me.id, email: me.email, nombre: me.nombre, apellido: me.apellido, rol: me.rol }
  },
})

interface Resultado {
  ok: boolean
  texto: string
}

async function ejecutar(operacion: () => Promise<unknown>): Promise<Resultado> {
  try {
    return { ok: true, texto: JSON.stringify(await operacion(), null, 2) }
  } catch (e) {
    const detalle = e instanceof ErrorApi ? `${e.status} · ${e.code}\n${e.message}` : mensajeError(e)
    return { ok: false, texto: detalle }
  }
}

function Bloque({ titulo, resultado }: { titulo: string; resultado?: Resultado }) {
  if (!resultado) return null
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-slate-600">{titulo}</p>
      <pre
        className={`mt-1 overflow-x-auto rounded-lg border px-3 py-2 text-xs ${
          resultado.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'
        }`}
      >
        {resultado.texto}
      </pre>
    </div>
  )
}

export default function ApiDiagnosticoPage() {
  const { user } = useAuth()
  const [resultados, setResultados] = useState<Record<string, Resultado>>({})

  async function correr(clave: string, operacion: () => Promise<unknown>) {
    setResultados((r) => ({ ...r, [clave]: { ok: true, texto: '…' } }))
    const resultado = await ejecutar(operacion)
    setResultados((r) => ({ ...r, [clave]: resultado }))
  }

  const boton = 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50'

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-slate-200 px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Diagnóstico de la API</h1>
        <p className="text-xs text-slate-400 mt-0.5">Solo desarrollo. No existe en el build de producción.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <section>
          <h2 className="text-sm font-semibold text-slate-800">Configuración</h2>
          <p className="mt-1 text-xs text-slate-600">
            <code>VITE_API_URL</code>:{' '}
            {CONFIG_API.baseUrl ? <code data-testid="api-url">{CONFIG_API.baseUrl}</code> : 'no configurada (todo va por Supabase)'}
          </p>
          {CONFIG_API.desconocidos.length > 0 && (
            <p className="mt-1 text-xs text-red-700">
              Nombres que no son un dominio: {CONFIG_API.desconocidos.join(', ')}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5" data-testid="dominios">
            {DOMINIOS.map((dominio) => (
              <span
                key={dominio}
                data-dominio={dominio}
                data-camino={usaApi(dominio) ? 'api' : 'supabase'}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  usaApi(dominio) ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {dominio} · {usaApi(dominio) ? 'API' : 'Supabase'}
              </span>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-800">Llamadas directas a la API</h2>
          <p className="mt-1 text-xs text-slate-500">Con el token de tu sesión de Supabase.</p>
          <div className="mt-3 flex gap-2">
            <button className={boton} onClick={() => correr('health', () => desenvolver(getApi().GET('/health')))}>
              GET /health
            </button>
            <button className={boton} onClick={() => correr('me', () => desenvolver(getApi().GET('/me')))}>
              GET /me
            </button>
          </div>
          <Bloque titulo="/health" resultado={resultados.health} />
          <Bloque titulo="/me" resultado={resultados.me} />
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-800">Con flag: perfil</h2>
          <p className="mt-1 text-xs text-slate-500">
            El mismo dato por el camino que indique el flag del dominio <code>perfil</code>:{' '}
            ahora va por <strong>{usaApi('perfil') ? 'la API' : 'Supabase'}</strong>.
          </p>
          <div className="mt-3">
            <button className={boton} disabled={!user} onClick={() => correr('perfil', () => perfilConFlag(user?.id ?? ''))}>
              Pedir mi perfil
            </button>
          </div>
          <Bloque titulo="perfil" resultado={resultados.perfil} />
        </section>
      </div>
    </div>
  )
}
