# Configurar la suscripción mensual con MercadoPago — paso a paso

Guía operativa para dejar andando el cobro de la membresía del veterinario
independiente. El código ya está: lo que falta es la parte que no se puede
programar — crear la aplicación en MercadoPago, cargar credenciales y conectar
el webhook.

**Tiempo estimado:** 40–60 minutos la primera vez, casi todo esperando pantallas
de MercadoPago.

**Qué necesitás antes de empezar:**

- Acceso a la cuenta de MercadoPago de la empresa (la que va a recibir la plata).
- Acceso de owner/admin al proyecto de Supabase `cbllmyboxyoumnhakvyj`.
- La URL de producción del frontend en Vercel.

> **Regla que no conviene romper:** hacé los pasos 1 a 9 enteros en modo
> **prueba**, verificá que funciona, y recién después pasá a producción
> (paso 10). Con credenciales de producción cada prueba mueve plata real.

---

## Resumen de lo que vas a configurar

| # | Dónde | Qué queda configurado |
|---|---|---|
| 1 | MercadoPago | Aplicación creada |
| 2 | MercadoPago | Credenciales de prueba copiadas |
| 3 | MercadoPago | Usuarios de prueba (vendedor y comprador) |
| 4 | Supabase | Secrets `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `APP_URL` |
| 5 | Supabase | Migraciones aplicadas |
| 6 | Supabase | Precio del plan definido |
| 7 | Supabase | Edge Functions desplegadas |
| 8 | MercadoPago | Webhook apuntando a nuestra función |
| 9 | Los dos | Prueba de punta a punta |
| 10 | Los dos | Pasaje a producción |

---

## Paso 1 — Crear la aplicación en MercadoPago

1. Entrá a <https://www.mercadopago.com.ar/developers/panel/app> con la cuenta
   de la empresa.
2. Clic en **Crear aplicación**.

**Qué tenés que completar:**

| Campo | Qué poner |
|---|---|
| Nombre de la aplicación | `HarasManager` |
| ¿Qué producto estás integrando? | **Pagos online** |
| Plataforma / solución de pago | **Suscripciones** |
| Modelo de integración | **No, uso otra solución** (no usamos plugin de e-commerce) |
| Sitio web | La URL de producción del frontend |

3. Aceptá los términos y **Crear aplicación**.

**Cómo sabés que está completo:** volvés al panel y ves una tarjeta con el
nombre `HarasManager` y un **Application ID** numérico debajo. Anotalo, aunque
el código no lo usa: sirve para identificar la app cuando hables con soporte.

---

## Paso 2 — Copiar las credenciales de prueba

1. Entrá a la aplicación recién creada.
2. En el menú izquierdo: **Credenciales de prueba**.

**Qué vas a ver:** dos valores.

| Valor | Empieza con | ¿Lo usamos? |
|---|---|---|
| Public Key | `TEST-` | **No.** No tokenizamos tarjetas en nuestro frontend. |
| Access Token | `TEST-` | **Sí.** Es el `MP_ACCESS_TOKEN` del paso 4. |

3. Copiá el **Access Token** de prueba a un lugar seguro (gestor de
   contraseñas, no un chat ni un archivo del repo).

> **Importante:** el Access Token es equivalente a la llave de la caja. Con él
> se pueden crear cobros en nombre de la empresa. Nunca va al frontend, nunca
> se commitea, nunca sale por mail.

**Cómo sabés que está completo:** tenés un string largo que arranca con `TEST-`
guardado fuera del repo.

---

## Paso 3 — Crear los usuarios de prueba

MercadoPago no deja pagarte a vos mismo: para probar hacen falta dos cuentas
falsas, una que cobra y otra que paga.

1. En el panel: <https://www.mercadopago.com.ar/developers/panel/test-users>
2. Clic en **Crear usuario de prueba**, dos veces:

| Usuario | País | Para qué |
|---|---|---|
| Vendedor | Argentina | Recibe la plata (opcional si usás la cuenta real en modo test) |
| Comprador | Argentina | Es el "vet" que se suscribe en la prueba |

**Qué vas a ver:** por cada uno, un **usuario** (tipo `TESTUSER1234567`), una
**contraseña** y un **email** (tipo `test_user_12345678@testuser.com`).

3. Guardá los dos pares usuario/contraseña. Los vas a necesitar en el paso 9.

**Cómo sabés que está completo:** la lista de usuarios de prueba muestra dos
filas y tenés anotadas las dos contraseñas (no se pueden volver a ver después).

---

## Paso 4 — Cargar los secrets en Supabase

Las Edge Functions leen tres variables de entorno. Se cargan como *secrets* del
proyecto, no como variables del frontend — el frontend nunca las ve.

**Por el dashboard:**

1. Entrá a <https://supabase.com/dashboard/project/cbllmyboxyoumnhakvyj/settings/functions>
2. Sección **Edge Function Secrets** → **Add new secret**, tres veces:

| Nombre | Valor | De dónde sale |
|---|---|---|
| `MP_ACCESS_TOKEN` | `TEST-...` | Paso 2 |
| `MP_WEBHOOK_SECRET` | *(todavía no lo tenés)* | Paso 8 — dejalo para después |
| `APP_URL` | `https://<tu-dominio-de-vercel>` | Sin barra al final |

**O por CLI:**

```bash
supabase secrets set MP_ACCESS_TOKEN='TEST-xxxx' APP_URL='https://tu-dominio' --project-ref cbllmyboxyoumnhakvyj
```

> `APP_URL` es el origen al que MercadoPago devuelve al vet cuando termina de
> pagar. Si queda mal, el pago se hace igual pero el vet aterriza en una página
> rota. Tiene que ser exactamente el origen (sin `/` final, sin path).

**Cómo sabés que está completo:** en la lista de secrets aparecen
`MP_ACCESS_TOKEN` y `APP_URL` con el valor oculto (`•••`). `MP_WEBHOOK_SECRET`
lo vas a agregar en el paso 8.

---

## Paso 5 — Aplicar las migraciones

Las dos migraciones nuevas de esta rama:

- `20260813120000_plan_y_pagos_vet_mercadopago.sql` — tabla del plan, tabla de
  pagos, estado `pendiente` en la suscripción.
- `20260813120100_rpc_mercadopago_vet.sql` — funciones que usan las Edge
  Functions.

Se aplican con el MCP de Supabase (`apply_migration`), como el resto del
proyecto. **No** uses `supabase db push` ni el SQL Editor a mano.

> Si algo sale mal, el SQL exacto para deshacer estas dos migraciones está en
> `docs/specs/mercadopago-rollback.md`, junto con el registro de todo lo que se
> ejecutó contra la base.

**Cómo sabés que está completo:** corré esto en el SQL Editor y tenés que ver
las tres tablas y las tres funciones:

```sql
select table_name from information_schema.tables
 where table_name in ('plan_suscripcion_vet', 'pago_veterinario');

select proname from pg_proc
 where proname in ('mp_registrar_preapproval', 'mp_sincronizar_suscripcion', 'mp_registrar_pago');
```

---

## Paso 6 — Definir el precio del plan

La migración deja un precio **placeholder de $1000** que hay que reemplazar por
el precio real antes de habilitar el checkout.

En el SQL Editor de Supabase:

```sql
update plan_suscripcion_vet
   set precio = 25000,                                  -- el precio real
       nombre = 'Membresía veterinario — mensual'        -- lo ve el vet en el checkout de MercadoPago
 where codigo = 'mensual';
```

> El precio vive en la base justamente para que cambiarlo no requiera un deploy.
> Un superadmin lo puede editar cuando quiera; el checkout siempre toma el valor
> de la fila `activo = true`.

**Cómo sabés que está completo:**

```sql
select nombre, precio, moneda, frecuencia, frecuencia_tipo, activo
  from plan_suscripcion_vet where activo;
```

Tiene que devolver una sola fila, con tu precio, `ARS`, `1`, `months`, `true`.

---

## Paso 7 — Desplegar las Edge Functions

Tres funciones, y **la última no se despliega igual**:

```bash
supabase functions deploy crear-suscripcion-vet --project-ref cbllmyboxyoumnhakvyj
supabase functions deploy cancelar-suscripcion-vet --project-ref cbllmyboxyoumnhakvyj
supabase functions deploy mercadopago-webhook --no-verify-jwt --project-ref cbllmyboxyoumnhakvyj
```

> `--no-verify-jwt` en el webhook no es un descuido: MercadoPago no manda un JWT
> de Supabase, manda una firma HMAC. Si dejás la verificación de JWT puesta,
> Supabase rechaza **todas** las notificaciones con 401 antes de que la función
> llegue a correr, y no te enterás de ningún pago. La autenticación real de esa
> función es la firma, que se valida en la primera línea del handler.

**Cómo sabés que está completo:** en
<https://supabase.com/dashboard/project/cbllmyboxyoumnhakvyj/functions> las dos
aparecen listadas con estado *Active*. Además:

```bash
curl -i https://cbllmyboxyoumnhakvyj.supabase.co/functions/v1/mercadopago-webhook -X POST
```

En este punto tiene que devolver **503 `Not configured`**: la función corrió y
avisa que le falta el `MP_WEBHOOK_SECRET`, que se carga en el paso 8. Eso ya
confirma lo importante — que el `--no-verify-jwt` quedó bien puesto. Si en
cambio devuelve **401 con un JSON de Supabase que menciona el JWT**, el flag
faltó y hay que redesplegar.

Después del paso 8, el mismo `curl` tiene que devolver **401 `Invalid
signature`**: ahí la función ya tiene el secret y rechaza lo que no viene
firmado.

---

## Paso 8 — Configurar el webhook en MercadoPago

1. Volvé a la aplicación en el panel de MercadoPago.
2. Menú izquierdo: **Webhooks** → **Configurar notificaciones**.
3. Pestaña **Modo prueba**.

**Qué completar:**

> ⚠️ **Pegá la URL entera, con el camino completo.** Es el error más fácil de
> cometer, y el que más tiempo costó la primera vez: si guardás solo
> `https://cbllmyboxyoumnhakvyj.supabase.co`, MercadoPago la acepta sin
> chistar, muestra la configuración como válida, y manda todas las
> notificaciones a la raíz de Supabase, donde no hay nada. El síntoma es
> **"0% de notificaciones entregadas"** y cero llamadas en los logs de la
> función. Después de guardar, verificá que la URL que muestra el panel termine
> en `/functions/v1/mercadopago-webhook`.

| Campo | Valor |
|---|---|
| URL de producción / de prueba | `https://cbllmyboxyoumnhakvyj.supabase.co/functions/v1/mercadopago-webhook` |
| Eventos | En el panel actual alcanza con **Planes y suscripciones** (agrupa los tres tópicos de suscripción) y **Pagos**. No marques nada más — "Vinculación de aplicaciones" y el resto son de otras integraciones y solo generan ruido en los logs |

> Los tres tópicos se activan aunque la función solo procesa los dos primeros:
> MercadoPago pide tener `payment` prendido para las integraciones de
> suscripción, y la función responde 200 e ignora lo que no le corresponde.

4. **Guardar**.

**Qué vas a ver después de guardar:** aparece una **clave secreta** (un string
largo) con un botón para revelarla y otro para restablecerla.

5. Copiala y cargala en Supabase como `MP_WEBHOOK_SECRET` (mismo lugar del paso 4).
6. Volvé a desplegar el webhook para que tome el secret nuevo:

```bash
supabase functions deploy mercadopago-webhook --no-verify-jwt --project-ref cbllmyboxyoumnhakvyj
```

**Cómo sabés que está completo:**

```bash
curl -i https://cbllmyboxyoumnhakvyj.supabase.co/functions/v1/mercadopago-webhook -X POST
```

Ahora tiene que devolver **401 `Invalid signature`** (antes del secret devolvía
503). Eso confirma que la función tiene el secret y rechaza lo que no viene
firmado.

> Sobre el botón **Simular** de MercadoPago: sirve, pero **no esperes un 200**.
> El simulador manda un `data.id` inventado; la función valida la firma (bien),
> después consulta ese id contra la API de MercadoPago, no lo encuentra, y
> devuelve **500** para que la notificación se reintente. Eso es a propósito: un
> `GET` que falla puede ser una demora de propagación de MercadoPago, y dar el
> evento por perdido con un 200 significaría no activarle la membresía a alguien
> que pagó.
>
> Cómo leer el resultado del simulador: **401** = el secret está mal. **500** =
> la firma validó y el resto del circuito corrió (que es lo que se quería
> probar). La prueba de verdad es el paso 9.

---

## Paso 9 — Prueba de punta a punta

Ahora sí, el circuito completo con un vet de mentira.

1. **Abrí una ventana de incógnito** y entrá a la app.
2. Registrate como veterinario en `/registro-veterinario` (o usá un vet de
   prueba que ya tengas).
3. Entrá al panel: `/panel-vet`.

**Qué tenés que ver:** una tarjeta **Membresía** con la etiqueta gris **Plan
gratuito** y un botón `Suscribirme — $25.000/mes` (con el precio del paso 6).

> Si el botón dice **"no disponible"**, el plan no se está leyendo: revisá el
> paso 6.

4. Clic en **Suscribirme**. El navegador se va a MercadoPago.

**Qué tenés que ver:** el checkout de suscripciones de MercadoPago con el nombre
del plan y el importe mensual.

5. Iniciá sesión con el **usuario comprador de prueba** del paso 3.
6. Pagá con una **tarjeta de prueba**, completando el titular así:

| Dato | Valor |
|---|---|
| Número (Visa crédito) | `4509 9535 6623 3704` |
| Código de seguridad | `123` |
| Vencimiento | `11/30` |
| Nombre del titular | `APRO` ← esto es lo que hace que el pago se apruebe |
| Documento | DNI `12345678` |

7. Confirmá.

**Qué tenés que ver:** MercadoPago te devuelve a `/suscripcion/resultado`, con
la leyenda **"Confirmando tu pago"** y un spinner. En unos segundos tiene que
cambiar a **"Membresía activa"** en verde, con un botón **Ir a mi panel**.

8. Entrá al panel: la tarjeta **Membresía** ahora dice **Activa** en verde y
   muestra la fecha de renovación.

**Verificación en la base** (SQL Editor):

```sql
select s.estado, s.fecha_activacion, s.fecha_vencimiento, s.external_subscription_id, u.email
  from suscripcion_veterinario s join usuario u on u.id = s.usuario_id
 order by s.updated_at desc limit 5;

select estado, monto, moneda, fecha_pago, external_payment_id
  from pago_veterinario order by created_at desc limit 5;
```

- `suscripcion_veterinario.estado` = **`activa`**
- `fecha_vencimiento` ≈ hoy + 1 mes + 3 días de gracia
- `pago_veterinario` con al menos una fila y `estado = 'approved'`

**Si la pantalla se queda en "El pago está procesándose":** el webhook no llegó
o falló. Mirá los logs:
<https://supabase.com/dashboard/project/cbllmyboxyoumnhakvyj/functions/mercadopago-webhook/logs>

| Lo que ves en los logs | Qué significa |
|---|---|
| Nada, ninguna invocación | La URL del webhook está mal escrita en MercadoPago |
| `401 Invalid signature` | El `MP_WEBHOOK_SECRET` no coincide, o falta redesplegar |
| `No hay suscripción con preapproval ...` | El evento es de otra integración de la misma cuenta; es esperable |
| `Faltan MP_ACCESS_TOKEN...` | Falta cargar un secret (paso 4) |

9. **Probá el caso del límite.** Con el mismo vet, cargá 6 caballos propios,
   cancelá la suscripción desde la cuenta de MercadoPago del comprador de
   prueba, y esperá a que llegue el webhook de cancelación. Cuando la fecha de
   vencimiento pase, al entrar a la app tiene que aparecer el modal bloqueante
   con el botón `Retomar membresía — $25.000/mes` habilitado.

> Ojo con este punto: cancelar **no** corta el acceso en el acto. El vet
> conserva la membresía hasta la `fecha_vencimiento` que ya tenía paga. Es
> deliberado — cobrarle el mes y cortarle el acceso el día 2 sería peor.

---

## Paso 10 — Pasar a producción

Recién cuando el paso 9 salió bien de punta a punta.

1. En el panel de MercadoPago: **Credenciales de producción**. Puede pedirte
   completar datos de la empresa antes de habilitarlas.
2. Copiá el **Access Token** de producción (arranca con `APP_USR-`).
3. En Supabase, reemplazá el secret `MP_ACCESS_TOKEN` por el de producción.
4. En MercadoPago, **Webhooks** → pestaña **Modo productivo**: cargá la misma
   URL y los mismos tres eventos.
5. Copiá la clave secreta **de producción** (es distinta de la de prueba) y
   reemplazá `MP_WEBHOOK_SECRET` en Supabase.
6. Redesplegá las dos funciones para que tomen los secrets nuevos.
7. Verificá el precio del plan una última vez (paso 6).

**Cómo sabés que está completo:** hacé una suscripción real con una tarjeta
real, de monto bajo si querés probar barato, confirmá que
`suscripcion_veterinario.estado = 'activa'`, y después cancelala desde la cuenta
de MercadoPago del pagador.

---

## Cosas que conviene tener claras después

- **La renovación la maneja MercadoPago**, no nosotros. Cobra todos los meses
  solo y nos avisa por webhook. Si el cobro falla, reintenta hasta 4 veces
  dentro de una ventana de 10 días; después de 3 cuotas rechazadas cancela la
  suscripción automáticamente y nos manda el evento de cancelación.
- **Nadie corre un job de vencimientos.** El estado del vet se recalcula cuando
  entra a la app (`vet_estado_limite()` en `RequireAuth`). Está anotado en
  `docs/BACKEND-API-TASKS.md` como algo que en el backend debería ser un job.
- **Cambiar el precio no afecta a los ya suscriptos.** MercadoPago sigue
  cobrando el monto con el que se creó cada preapproval. Cambiar el precio a
  las suscripciones vivas requiere un `PUT /preapproval/{id}` por cada una, que
  hoy no está implementado.
- **El vet cancela desde MercadoPago**, no desde la app. No hay botón de baja en
  HarasManager; la tarjeta de membresía lo dice explícitamente.

---

## Errores que ya nos pasaron

Todos estos se vieron en la puesta en marcha del 12/08/2026. Están acá para que
la próxima vez se reconozcan en un minuto en vez de en una hora.

| Síntoma | Causa | Solución |
|---|---|---|
| `"Invalid value for back_url, must be a valid URL"` (400 al crear el preapproval) | `APP_URL` apuntaba a `http://localhost:5173`. MercadoPago exige una URL pública con `https` | Un túnel (VS Code dev tunnels, cloudflared) o la URL de preview de Vercel |
| `"Both payer and collector must be real or test users"` (400) | La aplicación vivía en la cuenta **real** y el pagador era un **usuario de prueba** | Para el sandbox, la aplicación tiene que estar creada **dentro de la cuenta vendedora de prueba**, y se usan sus credenciales (que dicen `APP_USR-` aunque sean falsas) |
| **0% de notificaciones entregadas**, cero llamadas en los logs | La URL del webhook se guardó sin el camino: solo el origen de Supabase | Corregirla a la URL completa y verificar en el panel que quedó bien |
| El botón **Confirmar** del checkout queda gris | Extensiones del navegador rompiendo el JavaScript de MercadoPago (aparece un error de CSP en la consola), o el bloqueo de cookies de terceros del incógnito | Un perfil limpio de Chrome: sin extensiones y sin el bloqueo del incógnito |
| El pago se hizo pero la app sigue en "pago pendiente" | El webhook no llegó | Revisar la URL configurada. Mientras tanto se puede sincronizar a mano con `mp_sincronizar_suscripcion()`, consultando el estado real con `GET /preapproval/{id}` |

Dos cosas que **no** son problema, aunque lo parezcan:

- **Pagar con dinero en cuenta funciona.** MercadoPago acepta `account_money`
  como medio de una suscripción y programa igual el débito del mes siguiente.
- **El simulador de webhooks devuelve 500** si le pasás el `data.id` de ejemplo
  (`123456`): la firma valida, pero el recurso no existe. Para probarlo de
  verdad, pasale el id de un preapproval real.

## Referencia rápida de las variables

| Variable | Dónde vive | Ejemplo |
|---|---|---|
| `MP_ACCESS_TOKEN` | Secret de Edge Functions | `APP_USR-1234...` (prod) / `TEST-1234...` (prueba) |
| `MP_WEBHOOK_SECRET` | Secret de Edge Functions | string largo del panel de Webhooks |
| `APP_URL` | Secret de Edge Functions | `https://harasmanager.vercel.app` |

Ninguna de las tres es una variable `VITE_*`: no van al `.env.local` del
frontend ni al build de Vercel. Si alguna termina ahí, está expuesta.

---

## Documentación oficial usada

- [Suscripciones sin plan asociado, con pago pendiente](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/integration-configuration/subscription-no-associated-plan/pending-payments)
- [Referencia: crear suscripción (`POST /preapproval`)](https://www.mercadopago.com.ar/developers/es/reference/online-payments/subscriptions/create-preapproval/post)
- [Referencia: obtener factura (`GET /authorized_payments/{id}`)](https://www.mercadopago.com.ar/developers/es/reference/online-payments/subscriptions/get-authorized-payment/get)
- [Webhooks y validación de firma](https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks)
- [Tarjetas de prueba](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/additional-content/your-integrations/test/cards)
