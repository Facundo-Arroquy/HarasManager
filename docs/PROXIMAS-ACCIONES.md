# Próximas acciones para lanzar el MVP — HarasManager

> **Estado:** propuesta para discutir y repartir entre Facu y el colaborador. Nada de esto está hecho ni asignado.
> **Fecha:** 2026-10-02 · **Rama:** `claude/charming-wozniak-xjnroc`
> **Complementa a:** [`docs/PLAN-MONETIZACION.md`](PLAN-MONETIZACION.md) (el *por qué* y el modelo de negocio). Este archivo es el *qué hacemos, en qué orden y cómo sabemos que terminó*.
>
> ⚠️ **Repositorio público.** Este documento no incluye datos de clientes ni detalles de seguridad. El detalle de la revisión de seguridad se maneja fuera del repo.

**Cómo usarlo:** cada tarea tiene un ID (`A1`, `C3`…). Copiá al tablero (`TASKS.md`) las que vayan arrancando, con responsable, y tildá acá cuando terminen. Esfuerzo: **S** ≈ 1–2 días · **M** ≈ 3–5 · **L** ≈ 1–2 semanas, por persona. Tipo: `código`, `config` (se hace en un panel), `externo` (depende de un tercero: contador, abogado, cliente).

---

## 0. Qué significa "lanzar el MVP"

Hoy la app **ya está en producción con un cliente ancla**. Lo que falta no es "ponerla online": es poder **aceptar y cobrarle a clientes nuevos sin que un dev intervenga en cada paso**, con garantías legales, de seguridad y de operación. Se distinguen tres hitos:

| Hito | Qué es | Estado |
|---|---|---|
| **Hito 1 — Cliente ancla pago** | El cliente que ya usa la plataforma firma, paga y recibe factura | Siguiente |
| **Hito 2 — Lanzamiento controlado** | Hasta 3–5 haras y los vets que ya los rodean, **por invitación y venta directa**. Alta manual aceptable, cobro semi-manual aceptable | **Objetivo de este documento** |
| **Hito 3 — Lanzamiento abierto** | Registro y pago autónomos, publicidad, marketing | Después (ver `PLAN-MONETIZACION.md` §13) |

> **Recomendación:** apuntar al **Hito 2**. Es lo que se puede cumplir con dos personas sin hipotecar la calidad, y genera los primeros ingresos y casos de éxito. El Hito 3 requiere cosas que hoy no existen (alta autónoma de haras, facturación automática, soporte escalable).

### Criterios de Go / No-Go del Hito 2

Se lanza solo si **todo** está en verde. Cada fila se verifica con evidencia, no con "creo que sí".

| Área | Criterio | Bloque |
|---|---|---|
| Seguridad | Revisión de seguridad completada y puntos abiertos cerrados o aceptados por escrito | A |
| Legal | T&C y Privacidad revisados por abogado y publicados; contrato de servicio listo | B |
| Fiscal | Se puede emitir factura y cobrar desde una entidad definida | B |
| Cobro | Un pago real procesado de punta a punta; estado de cuenta de la sociedad visible | C |
| Datos | Backup diario verificado con una **restauración probada** | D |
| Operación | Staging separado de producción; monitoreo y alertas activos; runbook de incidentes | D |
| Producto | QA completo pasado en staging; alta de un haras nuevo en menos de medio día | E |
| Comercial | Precios definidos y publicados; demo reproducible; landing apta para celular | F |
| Soporte | Canal y horarios definidos; guías mínimas; proceso de baja | G |

---

## 1. Decisiones que hay que tomar primero

Bloquean otras tareas. Una reunión de ~90 minutos entre Facu, el colaborador y (para DEC2 y DEC3) Gero alcanza para cerrarlas. Entre paréntesis, la recomendación.

| # | Decisión | Qué destraba |
|---|---|---|
| **DEC1** | **Alcance del lanzamiento:** ¿Hito 2 (controlado)? *(Sí)* | Todo el documento |
| **DEC2** | **Quién paga el Centro de Cría:** haras, vet o híbrido. *(Híbrido: `PLAN-MONETIZACION.md` §4.3)* | Planes, contrato, entitlements |
| **DEC3** | **Precios v0 y moneda** para haras. *(Se definen tras la conversación de valor; lista en USD con cobro en ARS)* | Contrato, landing, cobro |
| **DEC4** | **Entidad que factura** y tipo de comprobante *(con el contador)* | Cobro, facturación |
| **DEC5** | **Política de impago** *(15 días de gracia → solo lectura + exportación; nunca se corta el acceso a los datos clínicos)* | Estado de cuenta, contrato, T&C |
| **DEC6** | **Soporte:** canal, horario y tiempo de respuesta por plan | Contrato, guías |
| **DEC7** | **Entorno de staging:** proyecto Supabase aparte *(Sí; ver la tarea D1 de infraestructura)* | QA, ensayo general |
| **DEC8** | **Suscripciones de vets activadas a mano:** ¿cortesía o pagas por fuera? *(Revisarlas una por una)* | Migración a MercadoPago |
| **DEC9** | **Quién es responsable de qué** (hoy todo figura sin asignar en `TASKS.md`) | Todo |

---

## 2. Tareas por bloque

### A. Seguridad y calidad *(es el primer gate: antes de sumar usuarios nuevos)*

#### A1 — Completar la revisión de seguridad y cerrar lo que surja · `código` + `config` · L
- **Por qué:** el registro de veterinarios es público y hay datos personales y clínicos de terceros. Antes de traer más usuarios hay que cerrar los puntos abiertos.
- **Cómo:**
  - Alguien con acceso a la base de producción corre las verificaciones **de solo lectura** del informe privado de seguridad (fuera del repo) y revisa Advisors → Security en el Dashboard de Supabase.
  - Corregir los puntos por prioridad. Cada migración nueva y cada Edge Function se prueba **primero en staging** (D1) y se aplica a producción con aprobación explícita y con `apply_migration` (regla de `CLAUDE.md`).
  - Actualizar `docs/SKILL.md` en la misma PR de cada cambio de schema o policy.
- **Hecho cuando:** cada punto del informe está corregido y verificado, o descartado con evidencia, o aceptado por escrito con responsable.

#### A2 — Actualizar dependencias con vulnerabilidades conocidas · `código` · S–M
- **Por qué:** `npm audit` marca 10 vulnerabilidades en el árbol actual; casi todas tienen fix automático. `xlsx` **no tiene fix en npm**.
- **Cómo:** `npm audit fix` en una rama; probar a mano ruteo, build e importación de caballos; reemplazar `xlsx` por una alternativa mantenida (verificar licencia y tamaño; `CLAUDE.md` pide no sumar dependencias sin justificar) y mantenerlo cargado de forma lazy como hoy.
- **Hecho cuando:** `npm audit` sin vulnerabilidades altas o con las restantes justificadas por escrito.

#### A3 — Fijar versiones de las Edge Functions · `código` · S
- **Por qué:** las 5 funciones importan `@supabase/supabase-js@2` desde una CDN sin versión exacta; el código de cobro depende de ello.
- **Cómo:** fijar versión exacta (o `npm:`/`jsr:`), redeploy, probar crear/cancelar suscripción y webhook en modo prueba.
- **Hecho cuando:** ninguna función importa una versión flotante.

#### A4 — Tests de aislamiento y de roles · `código` · M–L
- **Por qué:** hoy hay un solo archivo de tests; el riesgo mayor es que una sociedad vea datos de otra. `BACKEND-API-TASKS.md` ya lo reconoce como "el test que justifica todo el bloque".
- **Cómo:** en el proyecto de **staging**, fixtures de 2 sociedades, admin, vet con membresía, vet sin membresía (solo `acceso_vet`), jugador/piloto y superadmin; una matriz que verifique qué lee y qué no cada rol sobre las tablas principales y las RPC de uso diario.
- **Hecho cuando:** la matriz corre en CI en cada PR y falla si alguien ve datos ajenos.

#### A5 — Tests de los flujos de dinero · `código` · M
- **Cómo:** pruebas de validación de firma del webhook, mapeo de estados de MercadoPago, idempotencia de pagos, vencimiento con 3 días de gracia y downgrade de vets.
- **Hecho cuando:** cada transición de estado de `suscripcion_veterinario` (y la futura de sociedades) tiene un test.

#### A6 — Headers de seguridad en el deploy · `config` · S
- **Cómo:** agregar en `vercel.json` (hoy solo tiene el *rewrite*) `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options` y `Referrer-Policy`. Probar que no rompan las fuentes de Google ni el checkout de MercadoPago.
- **Hecho cuando:** un escáner de headers (por ejemplo, securityheaders.com) da una nota razonable y la app sigue funcionando completa.

#### A7 — Configuración de Auth en Supabase · `config` · S
- **Cómo (Dashboard → Authentication):** confirmar que "Confirm email" esté activo; revisar quién puede registrarse y limitar abuso (rate limits, captcha de Auth si corresponde); política mínima de contraseñas; plantillas de email en español; `Site URL` y *Redirect URLs* solo con el dominio de producción.
- **Hecho cuando:** hay una captura/lista de la configuración revisada en el runbook (D6).

#### A8 — Cuentas del equipo: 2FA y accesos · `config` · S
- **Cómo:** activar doble factor en GitHub, Supabase, Vercel, MercadoPago, el proveedor de dominio y el email de soporte; listar quién es owner de cada uno; guardar credenciales en un gestor compartido (nunca en el repo ni por chat).
- **Hecho cuando:** hay una tabla "servicio → owner → 2FA activo" y ninguna cuenta crítica depende de una sola persona sin respaldo.

#### A9 — Buckets de Storage privados y política alineada · `config` · S
- **Por qué:** el SKILL indica que ambos buckets pasaron a privados con URLs firmadas el 2026-09-26, pero `docs/POLITICA-DE-PRIVACIDAD.md` (del 2026-09-20) todavía dice que las fotos se sirven por URL pública.
- **Cómo:** verificar el estado real de los buckets y de las policies; actualizar la política de privacidad para que diga lo que el sistema hace.
- **Hecho cuando:** el estado real y el texto coinciden.

---

### B. Legal, fiscal y administrativo *(casi todo es externo: pedir turno ya, tiene tiempos de espera)*

#### B1 — Entidad fiscal y facturación (contador) · `externo` · M
- **Cómo:** definir desde qué CUIT se factura (monotributo, sociedad u otra), tipo de comprobante, punto de venta, IVA e Ingresos Brutos, y cómo se documenta una tarifa en USD cobrada en pesos. Definir cómo se concilia MercadoPago con la facturación.
- **Hecho cuando:** se puede emitir una factura de prueba y existe una guía de una página: "cómo facturo a un cliente nuevo".

#### B2 — Términos y Condiciones y Política de Privacidad revisados · `externo` + `código` · M
- **Cómo:**
  - Abogado revisa ambos textos. Temas: suscripción y cancelación, devolución/exportación de datos, conservación del historial clínico inmutable, solicitudes de supresión, Ley 25.326, transferencia internacional (los datos están en una región fuera de Argentina) y subencargados (Supabase, Vercel, MercadoPago, proveedor de email).
  - Resolver los pendientes de `docs/POLITICA-DE-PRIVACIDAD.md`: completar domicilio legal y razón social/CUIT; **inscripción de la base en el registro de la AAIP**; verificar los DPA de cada prestador; borrar la nota interna.
  - Volcar el texto final en `/legales/privacidad` (hoy muestra una versión resumida) y en `/legales/terminos`; quitar el cartel de "BORRADOR" de `LegalPage.tsx`.
  - Decidir cómo se **vuelve a pedir la aceptación** cuando cambien los textos (versionado en `terminos_condiciones`).
- **Hecho cuando:** textos publicados, sin leyendas de borrador, aceptados por los usuarios existentes en su próximo ingreso.

#### B3 — Funcionalidades que la política ya promete · `código` · M
- **Por qué:** `docs/POLITICA-DE-PRIVACIDAD.md` anuncia dos cosas que hoy no existen: la pantalla "Modificar datos personales" (acceso, rectificación y eliminación) y un instructivo al iniciar sesión. Publicar el texto sin construirlas lo deja afirmando algo falso.
- **Cómo:** o se construyen (pantalla de perfil con edición de datos propios y solicitud de baja), o se ajusta el texto para describir el procedimiento real (por ejemplo, "escribí a soporte") hasta que existan.
- **Hecho cuando:** el texto publicado describe exactamente lo que el sistema hace.

#### B4 — Contrato de servicio para haras · `externo` · M
- **Cómo:** plantilla con alcance (módulos incluidos), precio y moneda, vigencia y renovación, política de impago (DEC5), soporte (DEC6), propiedad y confidencialidad de los datos, exportación al finalizar, límites de responsabilidad. Variante "cliente fundador": descuento explícito, compromiso de feedback y de caso de éxito.
- **Hecho cuando:** hay un PDF listo para firmar y un procedimiento de firma.

#### B5 — Cuenta de MercadoPago de la empresa · `externo` + `config` · S
- **Cómo:** cuenta a nombre de la entidad definida en B1, datos verificados, credenciales de producción, límites de cobro y retiro de fondos entendidos.
- **Hecho cuando:** las credenciales de producción están disponibles para C1 y guardadas en el gestor de secretos.

#### B6 — Dominio, marca y casillas · `config` · S
- **Cómo:** confirmar que el dominio (`harasmanager.com`) está a nombre de la entidad y que el equipo tiene acceso al DNS; configurar SPF/DKIM/DMARC para el email de soporte y de envío; evaluar el registro de la marca ante el INPI (no bloquea el lanzamiento).
- **Hecho cuando:** el correo del equipo no cae en spam y el dominio no depende de una cuenta personal.

---

### C. Cobro y planes

#### C1 — Terminar MercadoPago (cobro de vets) · `config` + QA · M
- **Cómo:** seguir `docs/specs/mercadopago-setup.md` pasos 1–10 **en modo prueba** primero (secrets, deploy de las 3 funciones con `--no-verify-jwt` en el webhook, URL completa del webhook, pago con usuario y tarjeta de prueba), correr el checklist de `QA.md`, y pasar a producción con **un cobro real propio** que se cancela después.
- **Ojo:** corregir primero el documento (tarea H1): los ejemplos usan $25.000 y el precio vigente es $10.000.
- **Hecho cuando:** un pago real aprobado activó una suscripción sin intervención manual y su cancelación funcionó.

#### C2 — Ordenar las suscripciones de vets manuales · `código`/datos · S
- **Cómo:** por cada una (DEC8): marcar cortesía (`notas`, `proveedor_pago = 'manual'`) o migrarla a MercadoPago con una fecha de corte comunicada al vet.
- **Hecho cuando:** ninguna suscripción "activa" queda sin explicación.

#### C3 — Precios v0 de los haras · `externo` · M
- **Cómo:** conversación de valor con el cliente ancla (preguntas en `PLAN-MONETIZACION.md` §3.5), benchmark de alternativas (pendiente de investigar), y proponer 2–3 tramos por cantidad de caballos más módulos. Probar la propuesta con 2–3 prospectos antes de publicar.
- **Hecho cuando:** hay una lista de precios aprobada (DEC3) y un criterio de descuento por contrato anual.

#### C4 — Modelo de planes para sociedades (v1 manual) · `código` · M–L
- **Por qué:** hoy no hay forma de registrar qué plan tiene un haras, hasta cuándo, ni cuánto paga.
- **Cómo:** implementar la propuesta de `PLAN-MONETIZACION.md` §4.1 **solo después de aprobarla** (`CLAUDE.md`: no se crean tablas que no estén en el SKILL): tablas de planes, límites y suscripción de la sociedad (más pagos manuales); sincronizar `sociedad_modulo` a partir del plan; pestaña **"Facturación"** en `/superadmin`; agregar las tablas nuevas al trigger `auditar`; actualizar `docs/SKILL.md`.
- **Hecho cuando:** el superadmin puede asignar un plan, vigencia y monto a una sociedad, registrar un pago, y los módulos del haras se habilitan solos.

#### C5 — Límites blandos y estado de cuenta visible · `código` · M
- **Cómo:** contador de caballos activos y usuarios frente al plan; aviso al acercarse al tope; banner de estado de cuenta (prueba, vence en N días, vencida) para el admin; sin bloquear la carga de registros clínicos.
- **Hecho cuando:** el admin ve su plan, su consumo y su vencimiento en un solo lugar.

#### C6 — Política de impago implementada · `código` · M
- **Cómo:** estados `trial → activa → gracia → vencida → cancelada` (DEC5); en `vencida` la app pasa a solo lectura y exportación; nunca se bloquea el acceso a datos clínicos.
- **Hecho cuando:** hay un test por transición y una prueba manual en staging con una sociedad de prueba.

#### C7 — Proceso operativo de cobro manual de haras · `externo` · S
- **Cómo:** checklist mensual en un documento: emitir factura, registrar el pago en la pestaña "Facturación", enviar el recibo, renovar vigencia, avisar vencimientos. Un solo responsable (DEC9).
- **Hecho cuando:** otra persona del equipo podría ejecutarlo siguiendo solo el documento.

#### C8 — Emails transaccionales mínimos · `código` + `config` · M
- **Cómo:** cuenta del proveedor de email con dominio verificado (B6); `RESEND_API_KEY` como secret; Edge Function de envío disparada desde `notificacion` (diseño en `BACKEND-API-TASKS.md`, fila 2026-08-15); plantillas de bienvenida, recibo, aviso de vencimiento, falla de cobro e invitación de usuario.
- **Hecho cuando:** los cinco emails llegan a una casilla real, con remitente del dominio, sin caer en spam.

---

### D. Infraestructura y operación

#### D1 — Entorno de staging separado · `config` · M
- **Cómo:** proyecto de Supabase aparte (o branch) con el schema de producción y datos ficticios; variables de entorno de Preview en Vercel apuntando a staging; las cuentas de demo se mudan acá y salen de producción.
- **Prerrequisito:** conciliar `supabase/migrations/` con el schema vivo (el SKILL documenta *drift*). Quien tenga acceso exporta el schema real y se deja una migración base; si no, un staging armado desde las migraciones **no coincide con producción**.
- **Hecho cuando:** se puede probar una migración o una Edge Function sin tocar producción, y no hay cuentas de demo en producción.

#### D2 — Backups y restauración probada · `config` · S
- **Cómo:** pasar a un plan de Supabase con backups diarios/PITR y sin pausa por inactividad (verificar condiciones vigentes); **restaurar un backup en staging** y confirmar que los datos están completos; documentar tiempos.
- **Hecho cuando:** hay un registro de una restauración exitosa con fecha y duración. Un backup que nunca se restauró no cuenta.

#### D3 — Plan comercial de Vercel y dominio · `config` · S
- **Cómo:** verificar si el plan actual permite uso comercial (los planes gratuitos suelen restringirlo; revisar los términos vigentes); dominio propio con HTTPS; que `main` sea el único que despliega a producción y las demás ramas generen *preview*.
- **Hecho cuando:** producción corre en un plan compatible con uso comercial y bajo el dominio de la empresa.

#### D4 — Monitoreo y alertas · `código` + `config` · M
- **Por qué:** hoy no hay monitoreo de errores del front ni un `ErrorBoundary`: si la app falla en el celular de un cliente, el equipo se entera por WhatsApp.
- **Cómo:** `ErrorBoundary` con mensaje amigable; una herramienta de reporte de errores del front (Supabase no la cubre, así que justifica la dependencia que pide `CLAUDE.md`); alertas de logs de Edge Functions, en especial el webhook de pagos; un chequeo de disponibilidad externo sobre la landing y el login; alertas a un canal del equipo.
- **Hecho cuando:** se provoca un error de prueba en staging y llega la alerta a quien corresponde.

#### D5 — Email de Auth con dominio propio · `config` · S
- **Cómo:** SMTP propio en Supabase Auth (el SMTP por defecto es limitado y pensado para pruebas; verificar límites vigentes) con el dominio verificado en B6; probar registro de vet, reseteo de contraseña y reenvío de confirmación.
- **Hecho cuando:** los mails de Auth llegan en segundos desde el dominio de la empresa.

#### D6 — Runbook de operación · `código`(docs) · M
- **Cómo:** `docs/runbooks/` con: (1) alta de un haras (E1), (2) deploy y rollback (Vercel: promover el deployment anterior), (3) aplicar una migración (staging → producción, con aprobación), (4) qué hacer si se cae la app / la base / el webhook de pagos, (5) restauración de backup, (6) rotación de secretos, (7) baja de un cliente y exportación de sus datos.
- **Hecho cuando:** otra persona puede ejecutar cada procedimiento sin preguntarle a quien lo escribió.

#### D7 — Flujo de cambios y versionado · `config` · S
- **Cómo:** proteger `main` (PR obligatorio con 1 revisión, CI verde); CI en GitHub Actions con lint, tipos, tests y build; etiquetar versiones y llevar un changelog corto.
- **Hecho cuando:** no se puede mergear a `main` sin PR, revisión y CI verde.

#### D8 — Rendimiento con más datos · `código` · S–M
- **Cómo:** revisar Advisors → Performance de Supabase; medir las pantallas de caballos, historial y centro de cría con un volumen mayor al actual (staging con datos sintéticos); agregar índices o paginación donde haga falta.
- **Hecho cuando:** las pantallas principales cargan en un tiempo aceptable con 3–5 veces el volumen actual.

#### D9 — Control de costos · `config` · S
- **Cómo:** alertas de gasto/uso en Supabase, Vercel y el proveedor de email; tabla de costos mensuales fijos para calcular el punto de equilibrio.
- **Hecho cuando:** hay un número de costo mensual y alertas por si se dispara.

---

### E. Producto y onboarding

#### E1 — Procedimiento de alta de un haras · `código`(docs) + `config` · S
- **Por qué:** el alta es manual (el superadmin crea la sociedad y las cuentas). Para el Hito 2 es aceptable si está **escrito y medido**.
- **Cómo:** checklist en el runbook: crear sociedad, módulos, primer admin, aceptación de T&C, carga inicial de caballos y campos, alta de vets con acceso, verificación final. Cronometrar con un haras de prueba.
- **Hecho cuando:** un alta completa se hace en menos de medio día siguiendo el documento.

#### E2 — Invitar usuarios nuevos desde el panel del admin · `código` · M
- **Por qué:** hoy el admin solo puede sumar a su haras personas que **ya tienen cuenta**; crear una cuenta nueva (piloto, jugador, peticero, otro admin) la hace únicamente el superadmin con la Edge Function `create-user`. Cada persona nueva de un cliente requiere a un dev.
- **Cómo:** nueva Edge Function de invitación por email, autorizada para el admin **de esa sociedad** (verificar membresía contra la base, igual que las demás funciones) y con lista cerrada de roles; la persona define su contraseña desde el enlace (sin que nadie la conozca); depende de D5 y C8.
- **Hecho cuando:** un admin invita a una persona nueva y esta entra sin intervención del equipo. *(Si no llega a tiempo para el Hito 2, se mantiene el alta por el superadmin y se documenta en E1.)*

#### E3 — Cambio de contraseña y primer ingreso · `código` · S
- **Por qué:** hoy existe "olvidé mi contraseña", pero no cambiarla desde adentro de la app (ticket "Cambiar contraseña" en `TASKS.md`); y las cuentas creadas por el superadmin se crean con una contraseña que define quien las crea.
- **Cómo:** sección "Mi cuenta" con cambio de contraseña; forzar el cambio en el primer ingreso de cuentas creadas por el superadmin (o reemplazar por el enlace de E2).
- **Hecho cuando:** un usuario cambia su contraseña desde la app y nadie conserva una contraseña ajena.

#### E4 — Importación de caballos: ampliar y endurecer · `código` · M–L
- **Estado real:** **ya existe** un importador por Excel para admin/jugador/piloto (`ImportarCaballosModal`, `utils/importarCaballos.ts`, con plantilla descargable y validación fila por fila). Para el veterinario hay un botón "próximamente" que deriva a soporte (`CargaMasivaProximamente`). No existe importación de historial, registros reproductivos ni propietarios; esas cargas se hicieron con migraciones SQL.
- **Cómo:**
  1. Habilitar la importación para el rol veterinario (respetando el tope de su plan y el campo propio de cada caballo).
  2. Endurecer: límite de filas y de tamaño, mensajes de error por fila, reporte de resultado (cuántas se crearon, cuáles fallaron) y que una fila inválida no frene el lote.
  3. Probar con una planilla real desordenada (nombres repetidos, fechas en distintos formatos, razas/pelajes que no están en el catálogo).
  4. Decidir (DEC1/DEC3) si la **carga inicial de historial** se ofrece como servicio pagado en lugar de construirla.
- **Hecho cuando:** un vet y un admin cargan 100+ caballos desde una planilla sin ayuda del equipo.

#### E5 — Primeros pasos dentro de la app · `código` · M
- **Cómo:** checklist de bienvenida para el admin ("cargá tus caballos → creá un campo → registrá tu primera consulta → dá acceso a tu vet") y para el vet ("cargá tus caballos → programá un trabajo sanitario"); estados vacíos útiles; terminar el ticket "Ayuda y tooltips" (en proceso, Facundo), con ayuda contextual básica.
- **Hecho cuando:** un usuario nuevo llega a su primer registro en menos de 15 minutos sin preguntar.

#### E6 — Cerrar los tickets en QA · `código` + QA · M
- **Cómo:** pasar a "terminado" o devolver a pendiente cada ticket que figura en `QA` en `TASKS.md`: freemium de vets, downgrade, cobro de MercadoPago, roles y membresías, alertas en el dashboard, Centro de Embriones editable, filtro por camada, partes afectadas del vet independiente, lista para la temporada. Usar las listas de `QA.md` en staging.
- **Hecho cuando:** `TASKS.md` no tiene ningún ticket de alta prioridad en estado `QA`.

#### E7 — Pase de QA completo previo al lanzamiento · QA · M
- **Cómo:** correr `QA.md` completo en staging con 2 personas, **un celular Android y uno iPhone** (se usa en el campo), los roles admin, vet con y sin membresía, jugador/piloto/peticero y superadmin; registrar fallas en `TASKS.md`.
- **Hecho cuando:** cero fallas bloqueantes y las no bloqueantes tienen ticket y fecha.

#### E8 — Triage de tickets pendientes · `código` · S
- **Cómo:** revisar los tickets `pendiente` de `TASKS.md` y marcar cuáles bloquean el lanzamiento y cuáles no. Algunos pueden estar vencidos (por ejemplo, el tag de yeguas preñadas ya parece existir según el SKILL: verificar). Los que no bloquean pasan a un backlog posterior.
- **Hecho cuando:** `TASKS.md` tiene una sección "Bloquea el lanzamiento" corta y verificada.

#### E9 — Entorno de demo para ventas · `config` · S
- **Cómo:** una sociedad de demo con datos ficticios y realistas (en staging, no en producción), con usuarios por rol, que se pueda **reiniciar** a su estado inicial antes de cada demo.
- **Hecho cuando:** una demo de 20 minutos se puede dar sin tocar datos reales.

---

### F. Landing y comercial

#### F1 — Landing lista para móvil · `código` · M
- **Cómo:** optimizar el video del hero (comprimirlo, agregar imagen de carga `poster`, y no cargarlo en conexiones lentas o pantallas chicas; ticket "Cambiar video del fondo"); achicar el `favicon.png` (hoy ~1,5 MB); poner el `og:image` con URL absoluta y probar la vista previa en WhatsApp; considerar prerenderizar la landing; sumar las **capturas reales del producto** (pendiente en `TASKS.md`).
- **Hecho cuando:** la landing carga rápido con datos móviles y el link compartido por WhatsApp muestra título, descripción e imagen.

#### F2 — Precios y propuesta visibles · `código` · S
- **Cómo:** sección de planes según C3 (si los precios van "a medida", al menos los tramos y qué incluye cada módulo), y comparación contra planillas/WhatsApp.
- **Hecho cuando:** un visitante entiende cuánto cuesta y qué recibe sin tener que escribir.

#### F3 — Formulario de contacto: consentimiento y antispam · `código` · S
- **Cómo:** casilla de aceptación enlazada a la política de privacidad; honeypot y límite de envíos (o captcha); **aviso al equipo por email/WhatsApp** cuando entra un lead (verificar si hoy existe; si no, se enteran solo al abrir el panel); usar los estados del funnel que el tipo `LeadEstado` ya admite.
- **Hecho cuando:** un lead nuevo llega con aviso en menos de 5 minutos y no entran envíos automáticos.

#### F4 — Medición básica · `código` + `config` · S–M
- **Cómo:** una herramienta de analítica respetuosa de la privacidad y con consentimiento; eventos: visita a la landing, lead enviado, registro de vet, checkout iniciado, pago confirmado.
- **Hecho cuando:** se puede ver de dónde viene cada lead y cuántos avanzan a demo y a pago.

#### F5 — Material de venta · `externo` · M
- **Cómo:** guion de demo (15–20 min) centrado en el Centro de Cría; one-pager; respuestas a objeciones habituales (datos, migración desde planillas, conexión en el campo, qué pasa si dejo de pagar); video corto del producto; caso de éxito del cliente ancla **con su permiso por escrito**.
- **Hecho cuando:** cualquiera del equipo puede dar la demo con el mismo guion.

#### F6 — Lista de prospectos y salida comercial · `externo` · M
- **Cómo:** armar una lista de 20–30 haras de cría y de polo, y de veterinarios de reproducción, con contacto y origen; seguirla en el panel de leads; pedir referidos al cliente ancla y a los vets que ya usan la plataforma; fijar una meta semanal de contactos y demos.
- **Hecho cuando:** hay una lista viva con estados y una cadencia de seguimiento semanal.

#### F7 — Programa de cliente fundador · `externo` · S
- **Cómo:** definir la oferta (descuento, duración, qué se pide a cambio) para los primeros 3 haras, usando la plantilla de B4.
- **Hecho cuando:** hay una propuesta de una página lista para enviar.

---

### G. Soporte

#### G1 — Canal, horario y compromiso de respuesta · `externo` · S
- **Cómo:** hoy el soporte es el email del equipo y los WhatsApp personales de los fundadores. Definir un canal principal, un horario y un tiempo de respuesta por plan (DEC6); evaluar una línea de WhatsApp de empresa para no depender de números personales.
- **Hecho cuando:** el cliente sabe a quién escribir, cuándo y en cuánto tiempo le responden.

#### G2 — Guías mínimas · `externo` · M
- **Cómo:** 8–10 guías cortas (con capturas): cargar caballos y campos, importar una planilla, registrar una consulta, programa semanal y recordatorios del Centro de Cría, dar acceso a un vet, transferir un caballo, cambiar contraseña, qué pasa si vence mi plan.
- **Hecho cuando:** las preguntas más repetidas de los primeros clientes tienen una guía enlazada desde la app.

#### G3 — Registro de pedidos e incidentes · `config` · S
- **Cómo:** un tablero único donde se anota cada consulta, error o pedido, con fecha, cliente, gravedad y estado; revisión semanal.
- **Hecho cuando:** ningún pedido de cliente vive solo en un chat.

#### G4 — Baja y exportación de datos del cliente · `código` · M
- **Por qué:** el contrato y la política de privacidad prometen devolver los datos. Hoy hay exportaciones puntuales de fichas pero no un "exportar todo".
- **Cómo:** una exportación completa por sociedad (caballos, historial, registros reproductivos, accesos) en planillas; procedimiento de baja en el runbook (D6); conservar el historial según los T&C.
- **Hecho cuando:** se puede entregar a un cliente que se va una exportación completa en un día.

#### G5 — Panel de métricas del negocio · `código` · M
- **Cómo:** pestaña "Métricas" en `/superadmin` derivada de la base (vistas SQL): suscripciones activas, haras y caballos activos, usuarios activos en 30 días, registros por módulo, activación por sociedad nueva. Sin sumar analítica externa para esto.
- **Hecho cuando:** las métricas de `PLAN-MONETIZACION.md` §6 se contestan sin escribir SQL a mano.

---

### H. Documentación del repo

- [ ] **H1** — Corregir `docs/specs/mercadopago-setup.md`: ejemplos de $25.000 (el precio vigente es $10.000) y la afirmación de que no hay botón de baja (ya existe en `MembresiaVetCard`). *(S)*
- [ ] **H2** — Actualizar `CLAUDE.md`: la app **ya está en producción**; el nombre real de la variable es `VITE_SUPABASE_ANON`; agregar la regla de "repositorio público: sin datos de clientes ni detalles de seguridad". *(S)*
- [ ] **H3** — Limpiar `.env.example` (variables de un proyecto Kanban separado que no se usan en el código del front) y documentar las variables de las Edge Functions en un solo lugar. *(S)*
- [ ] **H4** — Actualizar `docs/SKILL.md` con cada tabla, función o policy que se agregue (regla vigente) y con el modelo de planes de C4. *(continuo)*
- [ ] **H5** — Anotar en la tabla de `docs/BACKEND-API-TASKS.md` lo que quede para el backend futuro (servicio de suscripciones de sociedades, jobs de vencimiento, emisión de facturas, cola de emails). *(continuo)*
- [ ] **H6** — Conciliar `supabase/migrations/` con el schema vivo (ver D1). *(M)*

---

### I. Lanzamiento

#### I1 — Ensayo general en staging · QA · S–M
- **Cómo:** recorrer de punta a punta con datos de prueba: contrato → alta de haras (E1) → carga por planilla (E4) → uso de cada rol → invitación de usuario (E2) → pago de prueba y renovación (C1/C4) → vencimiento y degradación (C6) → baja y exportación (G4). Cronometrar y anotar fricciones.
- **Hecho cuando:** el recorrido sale sin intervención de un dev, salvo los pasos declarados como manuales.

#### I2 — Revisión Go / No-Go · reunión · S
- **Cómo:** una hora, con la tabla de criterios de la sección 0 y la evidencia de cada fila. Si una fila no está en verde, se pospone o se acepta el riesgo por escrito.
- **Hecho cuando:** acta con la decisión y los riesgos aceptados.

#### I3 — Salida · S
- **Cómo:** congelar cambios 48 horas antes; checklist de deploy y de rollback a mano (D6); tener a una persona de guardia durante la primera semana; avisar primero al cliente ancla y después a la lista de prospectos (F6).
- **Hecho cuando:** los primeros clientes invitados pueden ingresar y operar.

#### I4 — Primeras dos semanas · operación
- **Cómo:** revisión diaria de errores, pagos, leads y pedidos de soporte; reunión semanal de 30 minutos con las métricas (G5); lista de lo aprendido.
- **Hecho cuando:** hay un informe de las dos semanas con los problemas, las decisiones y los ajustes al plan.

---

## 3. Camino crítico y cronograma orientativo

**Esto se mueve más lento de lo que parece por tiempos de terceros.** Lo que depende de contador, abogado, MercadoPago y del cliente hay que pedirlo **ya**, aunque el trabajo técnico arranque después.

```
Decisiones (DEC1–DEC9) ─┬─► Precios y contrato (C3, B4) ─► Planes en la app (C4–C6) ─► Cobro manual de haras (C7)
                    ├─► Entidad fiscal (B1) ─► Cuenta MercadoPago (B5) ─► Cobro vets real (C1)
                    └─► Staging (D1) ─► Tests (A4–A5) ─► QA completo (E6–E7) ─► Ensayo (I1) ─► Go/No-Go (I2)
Seguridad (A1–A9) ───────────────────────────────────────────────────────────────────────────► Go/No-Go (I2)
Legal (B2–B3) ───────────────────────────────────────────────────────────────────────────────► Go/No-Go (I2)
```

Cronograma **orientativo** (dos personas, mezclado con el resto del producto; la fecha de lanzamiento depende de los tiempos externos, no solo del código):

| Semana | Foco | Entregables |
|---|---|---|
| **1** (5–9 oct) | Decisiones y pedidos externos | DEC1–DEC9 cerradas; turnos con contador y abogado; 2FA (A8); staging creado (D1); plan de Supabase y Vercel verificados (D2, D3); conversación de valor con el cliente ancla |
| **2** (12–16 oct) | Seguridad y cobro vets | A1 en curso, A2, A3, A6, A7, A9; MercadoPago en modo prueba (C1); backups y restauración (D2) |
| **3** (19–23 oct) | Base de planes y observabilidad | C4 (modelo y pestaña "Facturación"); D4 (monitoreo); D5 y B6 (email); A4 arrancado |
| **4** (26–30 oct) | Cobro de haras y legal | C5, C6, C8; B2 con el abogado; contrato (B4) listo para el cliente ancla; **Hito 1** (firma y primer cobro) |
| **5** (2–6 nov) | Onboarding | E2, E3, E4 (importador vet y endurecido), E5; G1–G3; runbook (D6) |
| **6** (9–13 nov) | Landing y venta | F1–F4; material (F5); prospectos (F6); métricas (G5); exportación (G4) |
| **7** (16–20 nov) | QA | E6, E7, D8; A4/A5 completos; cierre de H |
| **8** (23–27 nov) | Ensayo y salida | I1, I2, I3 → **Hito 2** si el Go/No-Go está en verde |

> Si el Hito 2 requiere más tiempo, lo que **se recorta primero** es E2 (queda el alta por el superadmin), F4 (analítica), G4 (exportación manual) y G5; **no se recorta** nada de A, B, ni de D1/D2/D4.

---

## 4. Qué NO hace falta para lanzar (control de alcance)

Para no inflar el alcance, esto queda **explícitamente fuera** del Hito 2:

- Backend FastAPI (se sigue con Supabase + Edge Functions; ver `PLAN-MONETIZACION.md` §7).
- Publicidad pagada (ver §13 del plan: se evalúa en el Hito 3).
- App móvil nativa y modo sin conexión.
- Cobro automático en USD o con tarjeta internacional.
- Plan "Vet Clínica" (varios vets bajo una cuenta).
- Alertas por WhatsApp (add-on futuro).
- Torneos v2, mejoras de Sanidad, marketplace de ventas de caballos.
- Facturación electrónica automática (la factura se emite a mano al principio).
- Importación de historial clínico como autoservicio (se ofrece como servicio).

---

## 5. Esta semana (arranque concreto)

- [ ] Reunión de decisiones DEC1–DEC9 (90 minutos).
- [ ] Pedir turno al contador (B1) y al abogado (B2).
- [ ] Activar 2FA y armar la tabla de owners de cada servicio (A8).
- [ ] Verificar el plan actual de Supabase (backups/pausa) y de Vercel (uso comercial) (D2, D3).
- [ ] Alguien con acceso a producción corre las verificaciones de solo lectura de la revisión de seguridad y las trae al equipo (A1).
- [ ] Crear el proyecto de staging (D1) y empezar a conciliar las migraciones (H6).
- [ ] Agendar la conversación de valor con el cliente ancla (C3).
- [ ] Repartir los bloques A–I con responsables en `TASKS.md` (DEC9).

---

## 6. Riesgos propios del lanzamiento

| Riesgo | Mitigación |
|---|---|
| Los tiempos externos (contador, abogado, MercadoPago) se estiran | Pedirlos en la semana 1; seguir el trabajo técnico en paralelo |
| Staging distinto de producción por el *drift* de migraciones | H6/D1 antes de empezar a probar |
| Se lanza con un cliente y un solo flujo probado | Ensayo general (I1) con todos los roles; QA en dos celulares |
| El soporte se come el tiempo de desarrollo | G1–G3 y guías (G2); incluir el nivel de soporte en cada plan |
| Dependencia de una sola persona para cobros y accesos | A8, C7 y D6: todo documentado y con respaldo |
| Prometer en los textos legales algo que el sistema no hace | B3 antes de publicar |
| Cambios de último momento rompen producción | Congelamiento de 48 horas, rollback probado (D6, I3) |

---

## 7. Mapa con `TASKS.md`

| Ticket actual (`TASKS.md`) | Tarea acá | Nota |
|---|---|---|
| Cobro de la membresía del vet con MercadoPago (Fase 2) | C1 | Falta configuración y QA |
| Freemium vets / Downgrade (QA) | E6 | Cerrar con las listas de `QA.md` |
| Definir roles y membresías — URGENTE (QA) | E6, A4 | Se valida con la matriz de roles |
| House limit | C5 | Pasa de baja a **bloquea el Hito 2** |
| Acceso al centro de embriones | DEC2 (decisión), C4 | Es la decisión de modelo del Centro de Cría |
| Cambiar contraseña | E3 | Sube de prioridad |
| Accesos | E2 | Relacionado con la invitación de usuarios |
| Armar una WEB / Landing; Cambiar video del fondo | F1, F2 | Capturas reales y precios |
| Ayuda y tooltips | E5 | En proceso (Facundo) |
| Mandarle a Gero el Excel base | E4 | Plantilla de importación |
| Lo legal pendiente de la landing | B2, B3 | Gate duro |
| Que superadmin maneje también veterinarios | — | Revisar si bloquea (E8) |
| Tag de yeguas preñadas + Próximos partos | E8 | Verificar si ya está hecho |

---

## 8. Mantenimiento de este documento

- Los tickets de las **semanas 1 y 2** (5 al 16 de octubre) ya están en `TASKS.md`, en la sección "Lanzamiento del MVP". Los de las semanas siguientes se generan de este archivo (§3) al cerrar la semana 2.

- Revisarlo **una vez por semana** con el equipo: tildar lo hecho, mover fechas, anotar bloqueos.
- Cada tarea que arranca pasa a `TASKS.md` con responsable; cuando termina se tilda acá y se actualiza `docs/SKILL.md` si tocó schema.
- Si cambia una decisión de la sección 1, actualizar las tareas que dependen de ella.
- **No agregar acá** datos de clientes ni detalles de seguridad: el repositorio es público.
