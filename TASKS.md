# TASKS — HarasManager

> Actualizar este archivo cuando se empiece o termine un ticket.
> Antes de arrancar una tarea, verificar que nadie más la tenga asignada.

## Cómo usar

- **Estado:** `pendiente` | `en proceso` | `QA` | `terminado`
- **Prioridad:** `alta` | `media` | `baja`
- **Asignado:** nombre del dev, o `-` si no está asignado aún
- En la sección de lanzamiento se usan además **Semana** (cuándo debería terminar) y **Depende de** (qué tiene que estar hecho antes)

---

## 🚀 Lanzamiento del MVP — semanas 1 y 2 (5 al 16 de octubre)

> El plan completo está en `docs/PROXIMAS-ACCIONES.md`: los IDs de cada título (`A8`, `C1`, `DEC1`…) remiten a ese archivo, donde está el detalle de cómo hacer cada cosa.
> Acá figuran solo los tickets de las **semanas 1 y 2**. Los de las semanas siguientes se generan desde ese archivo (§3) cuando cierre la semana 2 (ver el último ticket de esta sección).
> **Repositorio público:** no anotar en los tickets datos de clientes ni detalles de seguridad; eso va por un canal privado.
> **Todos están sin asignar** hasta que se cierre el ticket "DEC9 · Repartir responsables".
> Regla de oro de estas dos semanas: **nada se escribe en producción sin aprobación explícita**; lo que toque la base o las Edge Functions se prueba primero en staging (ticket D1).

### Semana 1 (5–9 oct)

### [ ] DEC1–DEC9 · Reunión de decisiones previas
- **Estado:** pendiente
- **Asignado:** -
- **Semana:** 1
- **Descripción:** Reunión de ~90 minutos con Facu, el colaborador y Gero (para DEC2 y DEC3). Cerrar las 9 decisiones de `docs/PROXIMAS-ACCIONES.md` §1: alcance del lanzamiento, quién paga el Centro de Cría, precios y moneda, entidad que factura, política de impago, soporte, staging, suscripciones de vets manuales y responsables.
- **Hecho cuando:** cada decisión tiene su respuesta escrita (agregar una columna "Decisión" a la tabla del §1) y quedan desbloqueadas las tareas que dependen de ellas.

### [ ] DEC9 · Repartir responsables de los bloques A–I
- **Estado:** pendiente
- **Asignado:** -
- **Semana:** 1
- **Depende de:** reunión DEC1–DEC9
- **Descripción:** Asignar un responsable a cada ticket de esta sección y a cada bloque de `docs/PROXIMAS-ACCIONES.md`, teniendo en cuenta cuánto tiempo real tiene cada uno por semana.
- **Hecho cuando:** todos los tickets de las semanas 1 y 2 tienen `Asignado` y nadie queda sobrecargado.

### [ ] B1 · Pedir turno al contador
- **Estado:** pendiente
- **Asignado:** -
- **Semana:** 1 (la reunión puede caer en la 2 o 3)
- **Descripción:** Pedir el turno y mandar las preguntas por adelantado: desde qué CUIT se factura, qué comprobante corresponde, punto de venta, IVA e Ingresos Brutos, cómo se documenta una tarifa en USD cobrada en pesos y cómo se concilia MercadoPago con la facturación. Es lo que más tiempo de espera tiene: el cobro de haras no se cierra sin esto.
- **Hecho cuando:** hay una fecha confirmada y la lista de preguntas enviada.

### [ ] B2/B4 · Pedir turno al abogado
- **Estado:** pendiente
- **Asignado:** -
- **Semana:** 1
- **Descripción:** Pedir el turno y enviar de antemano los T&C y la Política de Privacidad actuales, `docs/POLITICA-DE-PRIVACIDAD.md` con su lista de pendientes (domicilio legal, inscripción en la AAIP, acuerdos con proveedores, transferencia internacional) y el pedido de una plantilla de contrato de servicio para haras.
- **Hecho cuando:** hay una fecha confirmada y los documentos enviados.

### [ ] A8 · Doble factor y tabla de owners de cada servicio
- **Estado:** pendiente
- **Asignado:** -
- **Semana:** 1
- **Descripción:** Activar doble factor en GitHub, Supabase, Vercel, MercadoPago, el proveedor del dominio y el email de soporte. Armar la tabla "servicio → owner → 2FA activo → respaldo" y guardarla **fuera del repo**, en un gestor de contraseñas compartido.
- **Hecho cuando:** ningún servicio crítico depende de una sola persona sin respaldo y todos tienen 2FA.

### [ ] D2·D3 (parte 1) · Verificar los planes de Supabase y Vercel
- **Estado:** pendiente
- **Asignado:** -
- **Semana:** 1
- **Descripción:** Solo verificar y reportar, sin cambiar nada: plan actual de Supabase (backups diarios/PITR, pausa por inactividad), plan actual de Vercel (¿permite uso comercial? revisar los términos vigentes) y costo de pasar a los planes adecuados. Llevar el resultado a decisión de gasto.
- **Hecho cuando:** hay un resumen corto con plan actual, qué falta y cuánto cuesta, y una decisión de si se hace el cambio (se ejecuta en la semana 2, ver "D2 · Backups").

### [ ] A1 (parte 1) · Verificaciones de solo lectura de la revisión de seguridad
- **Estado:** pendiente
- **Asignado:** -
- **Semana:** 1
- **Descripción:** Alguien con acceso a la base de producción corre las consultas de **solo lectura** de la revisión de seguridad (se entregan por un canal privado, no están en el repo) y revisa Advisors → Security en el Dashboard de Supabase. No se modifica ningún dato ni ninguna policy en este ticket.
- **Hecho cuando:** los resultados fueron revisados por el equipo y cada punto quedó clasificado como "corregir", "descartar con evidencia" o "aceptar por escrito", en un documento privado.

### [ ] H6 · Conciliar `supabase/migrations/` con el schema vivo
- **Estado:** pendiente
- **Asignado:** -
- **Semana:** 1
- **Descripción:** El SKILL documenta *drift* entre las migraciones del repo y producción. Quien tenga acceso exporta el schema real (solo lectura, por ejemplo `supabase db dump --schema-only`), lo compara con `supabase/migrations/` y deja una migración base más un registro de las diferencias. No se aplica nada en producción. Es la base de D1: un staging armado desde las migraciones actuales **no coincidiría con producción**.
- **Hecho cuando:** existe una migración base y la comparación de tablas, funciones y policies entre la base y el repo está documentada.

### [ ] D1 · Crear el proyecto de staging
- **Estado:** pendiente
- **Asignado:** -
- **Semana:** 1 (empezar) – 2 (terminar)
- **Depende de:** H6
- **Descripción:** Proyecto de Supabase aparte con el schema de producción y datos ficticios; variables de entorno de *Preview* en Vercel apuntando a staging, para que cada PR genere un preview que no toque producción. Las cuentas de demo (`Haras Demo 1/2`) se mudan acá en un paso posterior.
- **Hecho cuando:** un PR genera un preview apuntando a staging y se puede probar una migración o una Edge Function sin tocar producción.

### [ ] DEC8/C2 · Ordenar las suscripciones de vets activadas a mano
- **Estado:** pendiente
- **Asignado:** -
- **Semana:** 1–2
- **Descripción:** Listar las suscripciones con `proveedor_pago` manual (consulta de solo lectura) y decidir una por una si es cortesía o si debe migrar a MercadoPago, con una fecha de corte avisada al vet. "Activa" hoy no significa "paga". Las escrituras en producción se hacen con aprobación explícita.
- **Hecho cuando:** cada suscripción manual quedó marcada (`notas`, `proveedor_pago = 'manual'`) o tiene una fecha de migración comunicada.

### [ ] C3 (parte 1) · Conversación de valor con el cliente ancla
- **Estado:** pendiente
- **Asignado:** -
- **Semana:** 1 (agendar) – 2 (realizar)
- **Descripción:** Agendar y hacer la conversación de ~45 minutos con el cliente ancla para fijar el precio inicial. Usar las preguntas de `docs/PLAN-MONETIZACION.md` §3.5: tiempo que ahorra hoy, qué usaban antes, costo de una transferencia o temporada perdida, presupuesto, qué los haría dudar del precio, frecuencia de pago y moneda.
- **Hecho cuando:** las notas están guardadas (fuera del repo si incluyen cifras del cliente) y hay una primera hipótesis de precio v0 para llevar a la decisión DEC3.

### [ ] B5 · Cuenta de MercadoPago de la empresa
- **Estado:** pendiente
- **Asignado:** -
- **Semana:** 1–2
- **Depende de:** DEC4 (entidad que factura)
- **Descripción:** Cuenta a nombre de la entidad definida, con datos verificados, credenciales de **prueba** y de **producción** disponibles, y entendidos los límites de cobro y de retiro de fondos. Las credenciales se guardan en el gestor de secretos, nunca en el repo ni por chat.
- **Hecho cuando:** las credenciales de prueba están listas para el ticket C1 y las de producción quedaron guardadas hasta el pasaje a producción.

### Semana 2 (12–16 oct)

### [ ] A1 (parte 2) · Corregir lo que surja de la revisión de seguridad
- **Estado:** pendiente
- **Asignado:** -
- **Semana:** 2
- **Depende de:** A1 (parte 1) y D1
- **Descripción:** Corregir los puntos clasificados como "corregir", por prioridad. Cada migración y cada Edge Function se prueba primero en staging y se aplica a producción con aprobación explícita, usando `apply_migration` (regla de `CLAUDE.md`). Actualizar `docs/SKILL.md` en la misma PR de cada cambio de schema o policy. El detalle de cada punto se mantiene fuera del repo.
- **Hecho cuando:** cada punto quedó corregido y verificado de nuevo, o descartado/aceptado por escrito con responsable.

### [ ] A2 · Actualizar dependencias con vulnerabilidades conocidas
- **Estado:** QA
- **Asignado:** -
- **Semana:** 2
- **Descripción:** `npm audit` marca 10 vulnerabilidades en el árbol actual y la mayoría tiene arreglo automático. Correr `npm audit fix` en una rama y probar a mano ruteo, build e importación de caballos. `xlsx` no tiene arreglo en npm: reemplazarlo por una alternativa mantenida (verificar licencia y tamaño; `CLAUDE.md` pide justificar dependencias nuevas) y mantenerlo cargado de forma lazy como hoy.
- **Hecho cuando:** `npm audit` no muestra vulnerabilidades altas, o las que quedan están justificadas por escrito.
- **Avance:** dependencias actualizadas; `xlsx` fue reemplazado por ExcelJS 4.4.0 (MIT) y se mantiene lazy. `npm audit` quedó sin vulnerabilidades altas (2 moderadas transitivas de `uuid` vía ExcelJS). Build y tests automáticos pasan; falta QA manual del ruteo y de una importación real.

### [ ] A3 · Fijar versiones de las Edge Functions
- **Estado:** QA
- **Asignado:** -
- **Semana:** 2
- **Descripción:** Las 5 funciones importan `@supabase/supabase-js@2` desde una CDN sin versión exacta. Fijar una versión exacta (o usar `npm:`/`jsr:`), volver a desplegar en staging y probar crear y cancelar suscripción y el webhook en modo prueba.
- **Hecho cuando:** ninguna función importa una versión flotante y las pruebas pasan.
- **Avance:** las 5 funciones usan `npm:@supabase/supabase-js@2.105.4`, versión exacta. Falta desplegar y probar en staging cuando D1 esté disponible; no se desplegó en producción.

### [ ] A6 · Headers de seguridad en Vercel
- **Estado:** QA
- **Asignado:** -
- **Semana:** 2
- **Descripción:** `vercel.json` hoy solo tiene el *rewrite*. Agregar `Content-Security-Policy`, `frame-ancestors`/`X-Frame-Options`, `X-Content-Type-Options` y `Referrer-Policy`. Probar en un preview que no se rompan las fuentes de Google, el video de la landing ni el checkout de MercadoPago.
- **Hecho cuando:** un escáner de headers da una nota razonable y la app funciona completa en el preview.
- **Avance:** `vercel.json` incorpora CSP, anti-framing, `nosniff` y política de referrer. El build pasa; falta validar fuentes, video, Supabase y checkout en un preview.

### [ ] A7 · Revisar la configuración de Auth en Supabase
- **Estado:** pendiente
- **Asignado:** -
- **Semana:** 2
- **Descripción:** En Dashboard → Authentication: confirmar que "Confirm email" esté activo; revisar quién puede registrarse y limitar el abuso (rate limits, captcha de Auth si corresponde), política mínima de contraseñas, plantillas de email en español, y que `Site URL` y *Redirect URLs* tengan solo el dominio de producción. Documentar el estado revisado.
- **Hecho cuando:** hay una lista de la configuración revisada, con lo que se cambió y por qué.

### [ ] A9 · Verificar que los buckets sean privados y alinear la Política de Privacidad
- **Estado:** pendiente
- **Asignado:** -
- **Semana:** 2
- **Descripción:** El SKILL indica que ambos buckets pasaron a privados con URLs firmadas el 2026-09-26, pero `docs/POLITICA-DE-PRIVACIDAD.md` (del 2026-09-20) todavía dice que las fotos se sirven por URL pública. Verificar el estado real de buckets y policies, y corregir el texto para que describa lo que el sistema hace.
- **Hecho cuando:** el estado real y el texto de la política coinciden.

### [ ] C1 · MercadoPago en modo prueba de punta a punta
- **Estado:** pendiente
- **Asignado:** -
- **Semana:** 2
- **Depende de:** B5 (credenciales de prueba) y D1 (staging)
- **Descripción:** Seguir `docs/specs/mercadopago-setup.md` pasos 1–9 **en modo prueba y, de ser posible, contra staging**: secrets, deploy de las 3 funciones (`--no-verify-jwt` en el webhook), URL completa del webhook, pago con usuario y tarjeta de prueba, cancelación y el caso del límite. Correr el checklist de MercadoPago de `QA.md`. **El paso 10 (producción) NO se hace en esta semana:** requiere que estén cerrados B1, B2 y B5.
- **Hecho cuando:** un pago de prueba aprobado activó la suscripción solo, la cancelación funcionó y el caso del límite se comportó como se espera.

### [ ] D2 (parte 2) · Backups y restauración probada
- **Estado:** pendiente
- **Asignado:** -
- **Semana:** 2
- **Depende de:** D2·D3 (parte 1) y D1
- **Descripción:** Aplicar la decisión tomada sobre el plan de Supabase (backups diarios/PITR, sin pausa por inactividad). **Restaurar un backup en staging** y confirmar que los datos están completos; anotar fecha y duración. Un backup que nunca se restauró no cuenta.
- **Hecho cuando:** hay un registro de una restauración exitosa con fecha y tiempo que tardó.

### [ ] H1–H3 · Corregir documentación desactualizada
- **Estado:** QA
- **Asignado:** -
- **Semana:** 2
- **Descripción:** `docs/specs/mercadopago-setup.md`: los ejemplos usan $25.000 y el precio vigente es $10.000; además afirma que no hay botón de baja y `MembresiaVetCard` ya lo tiene. `CLAUDE.md`: dice "sin producción aún" (la app ya está en producción), pide `VITE_SUPABASE_ANON_KEY` cuando el nombre real es `VITE_SUPABASE_ANON`, y conviene sumar la regla "repositorio público: sin datos de clientes ni detalles de seguridad". `frontend/.env.example`: quitar las variables de un proyecto Kanban separado que no se usan en el front.
- **Hecho cuando:** los tres archivos coinciden con la realidad y el cambio de `CLAUDE.md` fue revisado por el otro dev.
- **Avance:** precios y flujo de baja corregidos en la guía de MercadoPago; `CLAUDE.md` refleja producción, el nombre real de la variable y la regla del repo público; `.env.example` ya no incluye el Kanban. Falta revisión del otro dev.

### [ ] C3 (parte 2) · Investigar alternativas y referencias de precio
- **Estado:** pendiente
- **Asignado:** -
- **Semana:** 2
- **Descripción:** Relevar software de gestión de haras, reproducción equina y veterinaria, y las planillas o consultorías que hoy reemplazamos: qué incluye cada uno, cómo cobra y el precio cuando es público. Citar la fuente de cada dato; lo que no se pueda verificar se anota como tal.
- **Hecho cuando:** hay una tabla de 5 a 8 referencias con fuentes, lista para la decisión DEC3.

### [ ] SEG · Seguimiento semanal de este plan
- **Estado:** pendiente
- **Asignado:** -
- **Semana:** 1 y 2 (viernes)
- **Descripción:** 30 minutos cada viernes: tildar lo hecho en `docs/PROXIMAS-ACCIONES.md`, mover fechas, anotar bloqueos y actualizar el estado de los tickets de esta sección.
- **Hecho cuando:** el documento y `TASKS.md` reflejan el estado real al cierre de cada semana.

### [ ] CIERRE-S2 · Cierre de la semana 2 y tickets de las semanas 3–4
- **Estado:** pendiente
- **Asignado:** -
- **Semana:** 2 (viernes 16 oct)
- **Descripción:** Revisar qué se cumplió, qué se atrasó y por qué (especialmente lo que depende de terceros), replanificar y generar los tickets de las semanas 3 y 4 desde `docs/PROXIMAS-ACCIONES.md` §3: modelo de planes y pestaña "Facturación" (C4), monitoreo (D4), email propio (D5, B6), tests de aislamiento (A4), límites y estado de cuenta (C5, C6), emails transaccionales (C8) y revisión legal con el abogado (B2).
- **Hecho cuando:** `TASKS.md` tiene los tickets de las semanas 3 y 4, con responsables, y el cronograma del documento está actualizado.

---

## 🔴 Alta prioridad

### [x] Freemium para veterinarios independientes
- **Estado:** QA
- **Asignado:** -
- **Descripción:** Vet se registra solo (sin admin), gratis hasta 5 caballos propios sin sociedad; a partir del 6to necesita suscripción activada manualmente por superadmin (sin pasarela de pago todavía). Diseño completo en `docs/specs/roles-freemium-veterinarios.md`.
- **Avance:**
  - [x] Migraciones: tabla `suscripcion_veterinario`, función `vet_puede_agregar_caballo`, gate del límite en `crear_caballo_veterinario` (enforcement real — esa función es `SECURITY DEFINER` y bypasea RLS).
  - [x] Auto-registro: se extendió el trigger `handle_new_auth_user` para leer `rol_solicitado` del metadata de `auth.signUp()`, en vez de una Edge Function separada (evita depender de una sesión que no existe todavía si el proyecto exige confirmación de email, que es el caso acá).
  - [x] Página pública `/registro-veterinario` (signup + T&C vía el modal genérico existente).
  - [x] `NuevoCaballoModal`/`utils/error.ts`: paywall claro (`esLimiteCaballosVet`) en vez del error genérico de Postgres.
  - [x] Tab "Veterinarios" de `/superadmin`: caballos propios + estado de suscripción + activar/desactivar, sobre el sistema de módulos ya existente (`superAdminService`/`moduloService`). `PanelVetPage` ya servía como dashboard reducido del vet, no hizo falta uno nuevo.
- **Pendiente de QA manual:** flujo completo con un vet real (crear 5 caballos, confirmar bloqueo del 6to, activar suscripción, ver que desbloquea). Ver checklist en `QA.md`.
- **Ojo:** el flujo "vet crea/edita/lista/transfiere caballos propios sin sociedad" ya estaba construido de antes (RPCs, `/panel-vet`, `/transferir-vet`); lo nuevo acá fue solo el auto-registro y el límite. También se encontró un bug preexistente sin relación: `crearParaVet` intenta guardar genealogía con un `UPDATE` directo a `caballo` que la RLS actual (`es_admin(sociedad_id)`) rechaza en silencio para caballos de vet (`sociedad_id IS NULL`) — no se tocó, queda para otro ticket.

### [x] Downgrade del freemium de vets (caer del plan pago al gratuito)
- **Estado:** QA
- **Asignado:** -
- **Descripción:** El gate del freemium solo se evaluaba al crear, así que un vet que pagaba un mes, cargaba 50 caballos y dejaba de pagar se quedaba con los 50 para siempre. Ahora, al entrar, si tiene más caballos propios que el plan gratuito y no tiene suscripción vigente, un modal bloqueante lo obliga a regularizar.
- **Avance:**
  - [x] Migraciones `20260812120000`–`20260812120300`: `vet_limite_gratuito()` (el 5 en un solo lugar), `vet_suscripcion_activa()`, `vet_caballos_propios()`, `vet_estado_limite()` (chequeo retroactivo), `get_caballos_propios_vet()` y `dar_de_baja_caballos_veterinario()`.
  - [x] `LimiteCaballosVetModal`: lista de caballos propios con checkbox, contador de cuántos faltan dar de baja, confirmación previa y botón "Retomar membresía" deshabilitado (placeholder de MercadoPago).
  - [x] Montado en `RequireAuth`, después de los T&C para no apilar dos modales bloqueantes.
  - [x] De paso: `get_alertas_vet()` no filtraba por `caballo.activo`, así que un caballo dado de baja seguía generando alertas para siempre. Con la baja en lote eso pasaba a ser el caso normal.
  - [x] Reactivación: sección "Dados de baja" en `/panel-vet` (`CaballosDadosDeBajaVet`) + `reactivar_caballos_veterinario()`. Sin esto la baja era irreversible desde la app y el modal prometía algo que no existía.
- **Decisiones:** baja **lógica**, no borrado — `vet_caballos_propios()` cuenta solo activos, así que alcanza para regularizar y el historial clínico queda intacto. La reactivación es **manual** (el vet elige cuáles), no automática al reactivar la suscripción: hoy no se distingue una baja por límite de una por venta o muerte del animal, y revivir un caballo vendido porque volvió a pagar sería peor. Reactivar aplica el mismo gate que el alta, si no dar de baja y reactivar sería una evasión trivial del límite.
- **Ojo:** `dar_de_baja_caballos_veterinario` tuvo que ser `SECURITY DEFINER` porque la única policy de UPDATE sobre `caballo` es `es_admin(sociedad_id)` y los caballos de vet tienen `sociedad_id IS NULL` — el vet no puede darlos de baja con un update directo. Es la misma causa raíz del bug preexistente de genealogía en `crearParaVet` anotado en el ticket de arriba.

### [x] Cobro de la membresía del vet con MercadoPago (Fase 2)
- **Estado:** falta configuración + QA
- **Asignado:** -
- **Descripción:** El botón "Retomar membresía" era un placeholder deshabilitado: el freemium tenía gate, downgrade y activación manual del superadmin, pero no había forma de que el vet pagara solo. Ahora el checkout es una suscripción recurrente (preapproval) de MercadoPago y el estado lo mantiene un webhook.
- **Avance:**
  - [x] Migraciones `20260813120000`/`20260813120100`: `plan_suscripcion_vet` (el precio vive en la base, editable por superadmin sin deploy), `pago_veterinario` (auditoría + idempotencia del webhook), estado `'pendiente'` en `suscripcion_veterinario`, y las RPC `mp_registrar_preapproval` / `mp_sincronizar_suscripcion` / `mp_registrar_pago`.
  - [x] Edge Function `crear-suscripcion-vet`: crea el preapproval y devuelve el `init_point`. El usuario sale del JWT.
  - [x] Edge Function `mercadopago-webhook`: valida la firma HMAC, re-consulta el estado contra la API de MercadoPago y sincroniza. Se despliega con `--no-verify-jwt`.
  - [x] Front: `suscripcionVetService`, botón habilitado en `LimiteCaballosVetModal`, tarjeta `MembresiaVetCard` en `/config-vet/suscripcion` (menú plegable **Configuración** al pie del sidebar, arriba de "Cerrar sesión", solo para rol veterinario), y página `/suscripcion/resultado`.
  - [ ] **Configuración pendiente (no es código):** crear la aplicación en MercadoPago, cargar los tres secrets, definir el precio real, desplegar las funciones y conectar el webhook. Paso a paso en `docs/specs/mercadopago-setup.md`.
  - [ ] QA manual — checklist nuevo en `QA.md`.
- **Decisiones:** preapproval y no pago único, siguiendo lo ya definido en el spec. Checkout **redirect**, sin tokenizar tarjetas en nuestro frontend, para no entrar en el alcance de PCI. Cancelar **no** corta el acceso en el acto: el vet conserva la membresía hasta la `fecha_vencimiento` que ya pagó (esto cambió `vet_suscripcion_activa()`). Vencimiento con 3 días de gracia sobre `next_payment_date`, si no un vet al día se comía el modal bloqueante entre el vencimiento y el webhook del cobro nuevo.
- **Ojo:** `/suscripcion/resultado` va **fuera** de `RequireAuth` a propósito — ese guard monta el modal bloqueante del límite y dejaría al vet que acaba de pagar atrapado detrás justo mientras se espera la confirmación. La reactivación de los caballos que dio de baja **sigue siendo manual** aunque pague: la baja por límite y la baja por venta/muerte no se distinguen en la base.

### [ ] Definir roles y membresías — URGENTE
- **Estado:** QA
- **Asignado:** -
- **Descripción:** Separar bien lo que es membresía (empresa con sus usuarios) de rol. Un veterinario es user de la plataforma; una persona tiene un rol pero pertenece a una empresa/membresía. No está claro si hacer un solo admin y que después agregue a varios. Revisar modelo de permisos completo en `docs/SKILL.md`.

### [x] Fix de nombre del caballo en acceso a vets
- **Estado:** terminado
- **Asignado:** -
- **Descripción:** El nombre del caballo no se muestra correctamente en la sección de accesos a veterinarios.

### [x] No se guarda si es receptora/donante/nada
- **Estado:** terminado
- **Asignado:** -
- **Descripción:** El campo `rol_reproductivo` (Donante / Receptora / null) en la tabla `caballo` no se está guardando correctamente.

### [x] Fix Centro de embriones en panel reproductivo
- **Estado:** terminado (sin arreglar — la pantalla se eliminó)
- **Asignado:** -
- **Descripción:** Aparecía "Error al cargar datos" desde el lado de admin. Causa probable: problema de permisos RLS o query incorrecta.
- **Cierre:** el panel reproductivo (`/centro-cria` → `DashboardCriaPage`) se sacó del menú y del router, así que el bug ya no tiene dónde manifestarse. **La causa raíz nunca se confirmó**: si el mismo error aparece en otra pantalla del centro, arrancar por acá. La página está en el historial de git si hace falta recuperarla.

### [ ] Alertas en dashboard
- **Estado:** QA
- **Asignado:** -
- **Descripción:** Mostrar alertas en el dashboard de los próximos 7 o 10 días.
- **Avance:** Widget "Alertas próximas" en DashboardPage: muestra hasta 5 alertas vencidas + hoy + próximos 7 días, con badge de estado y link a /alertas.

### [ ] Centro Embriones editable
- **Estado:** QA
- **Asignado:** -
- **Descripción:** Que todas las reglas de alerta del centro sean editables por cada veterinario (por defecto como están ahora). Además renombrar la sección "Transferencias" del centro como "Transferencias de embriones".

### [ ] Filtro por camada en panel de caballos
- **Estado:** QA
- **Asignado:** -
- **Descripción:** Agregar filtro en el panel de caballos para ver por camada. Incluir un selector de rango de fechas (calendario de → hasta) basado en la fecha de nacimiento para acotar los resultados por temporada o período.

### [ ] Tag de yeguas preñadas + Próximos partos
- **Estado:** pendiente
- **Asignado:** -
- **Descripción:** Mostrar un tag visual en el listado/ficha de cada yegua que indique si está preñada. El tag debe incluir el padrillo o, en caso de inseminación artificial, el semen utilizado. Definir dónde se carga este dato (historial reproductivo, ficha del caballo, etc.) y cómo se representa en DB. A partir de ahí, agregar la categoría "Yegua preñada" y calcular/mostrar las fechas estimadas de parto (gestación equina ≈ 340 días) para tener un listado de próximos partos ordenado por fecha.

### [ ] Ayuda y tooltips
- **Estado:** en proceso
- **Asignado:** Facundo
- **Descripción:** Agregar chatbot de ayuda básico predefinido y tooltips en la interfaz.

### [x] Inventarle nombre y logo con color característico
- **Estado:** terminado
- **Asignado:** -
- **Descripción:** Definir nombre del producto, logo e identidad visual con color característico.

### [ ] Mandarle a Gero el Excel base
- **Estado:** en proceso
- **Asignado:** Facundo
- **Descripción:** Preparar y enviar el archivo Excel base a Gero.

### [ ] Orden de listas panel programa semanal
- **Estado:** pendiente
- **Asignado:** -
- **Descripción:** En la tabla de programa semanal debe tener las listas de receptoras y donantes separadas por empresa y campo en lo posible.
- **Ojo:** el rediseño del Programa Semanal movió la separación Donante/Receptora adentro de cada día de la semana, y en ese movimiento se sacó el panel lateral que agrupaba por empresa → campo. La separación por rol quedó, la de empresa/campo no. Hay que definir cómo reintroducirla en el nuevo layout (¿subtítulo de empresa dentro de cada grupo del día?, ¿un filtro de empresa arriba del calendario?).

---

## 🟡 Media prioridad

### [x] El vet independiente no ve partes afectadas ni medicamentos
- **Estado:** QA
- **Asignado:** -
- **Descripción:** El veterinario independiente (autoregistrado en `/registro-veterinario`, sin membresía) abría una consulta del historial y veía diagnóstico/tratamiento/observaciones pero las partes afectadas y los medicamentos le venían vacíos, incluso los que cargó él mismo.
- **Causa:** `historial_clinico_select` contempla `tiene_membresia` **o** `acceso_vet` activo, pero `historial_parte_afectada_select` e `historial_medicamento_select` solo tenían `tiene_membresia` → `false` para el vet sin membresía, así que la consulta madre se veía y los hijos no.
- **Fix:** migración `20260907120000_rls_historial_hijos_acceso_vet` — le suma a esas dos policies SELECT la misma rama `acceso_vet` que la tabla madre. Sin cambios de frontend.
- **Pendiente de QA:** con un vet independiente real, abrir una consulta de un caballo al que tiene acceso y confirmar que ahora ve partes afectadas y medicamentos.

### [ ] Registro persiste en centro de embriones
- **Estado:** pendiente
- **Asignado:** -
- **Descripción:** Todos los registros que se le hagan a una yegua deben persistir en el animal, así si luego de un tiempo agarramos una yegua que se le hizo cosas en el centro podemos identificar qué se le hizo. CREO QUE YA ESTÁ, HAY QUE HACERLE DOBLE CHECK.

### [ ] Accesos
- **Estado:** pendiente
- **Asignado:** -
- **Descripción:** Una sección de accesos que los admin del grupo puedan gestionar.

### [ ] Cambiar video del fondo
- **Estado:** pendiente
- **Asignado:** -
- **Descripción:** Reemplazar el video de fondo actual en la pantalla de login/landing.

### [ ] Acceso al centro de embriones
- **Estado:** pendiente
- **Asignado:** -
- **Descripción:** Definir la mejor estrategia: si los veterinarios tienen acceso siempre y solo ven los caballos con acceso, o si el acceso depende del plan del propietario (centro activo).

### [ ] Lista de caballos para la temporada
- **Estado:** QA
- **Asignado:** -
- **Descripción:** Que los usuarios puedan armar el listado de caballos para la temporada en formato kanban.
- **Avance:** se implementó como módulo **Torneos** (`/torneos`). El admin crea el torneo (nombre, temporada/fechas, jugadores participantes) y reparte los caballos con tag "Jugador" en un tablero kanban con drag & drop: columna de disponibles + una columna por jugador, con reordenamiento dentro de cada columna. Un caballo no puede quedar asignado a dos jugadores del mismo torneo. Los torneos finalizados quedan como historial consultable.
- **Pendiente de definición:** hoy "disponible" = caballo activo, de la sociedad y con tag Jugador. No hay noción de lesión o descanso.

### [ ] Torneos — mejoras de la v2
- **Estado:** pendiente
- **Asignado:** -
- **Descripción:** Mejoras que quedaron fuera del alcance del módulo de Torneos:
  - Control de disponibilidad por lesión o descanso (hoy no existe el dato en el modelo).
  - Restricción de cantidad máxima de caballos por jugador.
  - Seguimiento de resultados deportivos por torneo.
  - Estadísticas de participación por caballo y por jugador.
  - Impresión / exportación de la lista final del torneo (el proyecto ya usa `xlsx`).

### [ ] Que superadmin maneje también veterinarios
- **Estado:** pendiente
- **Asignado:** -
- **Descripción:** Que desde el panel de superadmin se puedan crear o dar de baja veterinarios.

### [ ] En consulta ADD un PNG
- **Estado:** pendiente
- **Asignado:** -
- **Descripción:** Permitir cargar una imagen en cada consulta del historial clínico para seguimiento.

---

## 🟢 Baja prioridad

### [ ] House limit
- **Estado:** pendiente
- **Asignado:** -
- **Descripción:** Limitar la cantidad de registros desde el superadmin según el plan contratado por cada sociedad.

### [ ] Cambiar contraseña
- **Estado:** pendiente
- **Asignado:** -
- **Descripción:** Agregar un panel a cada usuario para que pueda cambiar su contraseña.

### [ ] Armar una WEB / Landing
- **Estado:** en proceso
- **Asignado:** -
- **Descripción:** Landing pública con "quiénes somos", qué ofrecemos, etc.
- **Avance:** `frontend/src/pages/landing/LandingPage.tsx` con Hero, Problema/Solución,
  Cómo funciona, Funcionalidades, Para quién, Confianza, FAQ, formulario de contacto
  (+ WhatsApp) y footer. Rutas públicas `/legales/terminos` y `/legales/privacidad`
  (`frontend/src/pages/legales/LegalPage.tsx`).
- **Pendiente:** sección "vista del producto" con capturas reales del panel (PR aparte).
- **Pendiente legal:** los textos de `/legales/terminos` y `/legales/privacidad` son un
  borrador de referencia — un abogado debe revisarlos antes de producción, en particular
  el tratamiento del historial clínico y la Ley 25.326 de Protección de Datos Personales.

---

## ✅ Terminado

### [x] Rediseño de la UI de Caballos (vista grilla)
- **Prioridad:** media
- **Descripción:** El listado pasa a tarjetas con foto en grilla, con toggle grilla/lista que recuerda la preferencia. Cada tarjeta muestra campo, rol reproductivo, RP y chip, con botones "Ver ficha" (detalle rápido) e "Historial". Se mantienen los filtros, el modo de edición masiva y la subsección "Dados de baja".

### [x] Fix Genealogía
- **Prioridad:** alta
- **Descripción:** Corrección de bugs en el árbol genealógico.

### [x] Fix Selección animal en centro de embriones
- **Prioridad:** alta
- **Descripción:** En el centro de embriones no dejaba seleccionar un animal al querer agregar un registro.

---

## 🚫 No se hace

_(vacío por ahora)_
