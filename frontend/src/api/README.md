# Cliente de la API del backend

La migración al backend es gradual (`docs/PLAN-MIGRACION-BACKEND.md`): cada dominio puede ir por la
API o seguir hablando directo con Supabase, según un flag. **Apagado es el camino de hoy**, así que
no tocar nada deja la app exactamente igual.

```
src/api/
├── schema.d.ts   tipos generados desde el contrato OpenAPI del backend (no se edita)
├── cliente.ts    `getApi()`: cliente tipado que manda el token de la sesión de Supabase
├── errores.ts    `ErrorApi`: tiene `code` y `message`, igual que los errores de Supabase
├── flags.ts      qué dominios van por la API (`usaApi('campos')`)
├── conFlag.ts    elige entre el camino de Supabase y el de la API en cada llamada
└── index.ts      lo que importan los services
```

## Prender un dominio

En `frontend/.env.local` (no se versiona; Vite reinicia solo al cambiarlo):

```bash
VITE_API_URL=http://127.0.0.1:8000     # backend en local; sin esto, ningún dominio usa la API
VITE_API_DOMINIOS=perfil               # dominios por la API, separados por coma (`*` = todos)
```

Los nombres válidos son los de `DOMINIOS` en `flags.ts`. Un nombre mal escrito no enciende nada y
avisa por consola en desarrollo.

## Migrar un service

Así lo hace cada fase de dominio. El camino de Supabase es el código de hoy, sin tocar:

```ts
import { conFlag, desenvolver, getApi } from '../api'

export const listarCampos = conFlag('campos', {
  supabase: (sociedadId: string) => listarDesdeSupabase(sociedadId),
  api: (sociedadId: string) =>
    desenvolver(
      getApi().GET('/sociedades/{sociedad_id}/campos', {
        params: { path: { sociedad_id: sociedadId } },
      }),
    ),
})
```

- **Los dos caminos tienen que devolver lo mismo** (misma forma y mismos errores). De eso se ocupan
  los tests de cada dominio, con el oráculo del backend (`backend/tests/oraculo.py`).
- `desenvolver` devuelve los datos o lanza un `ErrorApi`, que es lo que hacen los services de hoy
  con `if (error) throw error`. Los errores llevan el mismo `code` (`HM001`, `HM002`…), así que
  `utils/error.ts` y las pantallas no cambian.
- El flag se lee en cada llamada, no al cargar el módulo.
- Si la API responde `token_vencido`, el cliente renueva la sesión de Supabase y reintenta **una** vez.
- Sin conexión con la API se lanza un `ErrorApi` con `status` 0 y `code` `sin_conexion`.

## Regenerar el cliente

Cada vez que cambia un endpoint o un schema del backend, y commitear el resultado:

```bash
./scripts/generar-cliente-api.sh          # desde la raíz del repo
./scripts/generar-cliente-api.sh --check  # solo verifica (para CI): falla si algo está desactualizado
```

Exporta el contrato a `backend/openapi.json` y genera `src/api/schema.d.ts`. No necesita el backend
levantado. El generador (`openapi-typescript`) se corre con `npx` y versión fijada: no es dependencia
del proyecto porque pide `typescript@^5` como peer y acá se usa TypeScript 6.

## Ver que anda

En desarrollo, `/dev/api` (con la sesión iniciada) muestra qué dominios están prendidos y llama a la
API con tu token: `GET /health`, `GET /me` y un dato pedido por el camino que diga el flag. Esa
página no existe en el build de producción.

## Antes de desplegar la API

La política de seguridad de `vercel.json` solo deja conectarse a `*.supabase.co`: hay que agregar el
dominio de la API a `connect-src`, o el navegador va a bloquear las llamadas en producción. En local
no molesta (esa política solo la aplica Vercel).
