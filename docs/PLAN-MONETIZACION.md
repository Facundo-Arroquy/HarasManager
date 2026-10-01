# Plan de monetización — HarasManager

> **Estado:** propuesta para discutir entre Facu y el colaborador. No hay nada implementado a partir de este documento.
> **Fecha:** 2026-10-01 · **Rama:** `claude/charming-wozniak-xjnroc` (base `main` @ `95c0caf`)
>
> **De dónde salen los datos:** (a) el repo (`docs/SKILL.md`, `TASKS.md`, `docs/specs/*`, `docs/BACKEND-API-TASKS.md`, código del front y Edge Functions) y (b) un relevamiento interno del uso real de la plataforma, **cuyos números se dejan fuera de este documento porque el repositorio es público**. Acá solo figuran conclusiones cualitativas.
> Todo lo que es **hipótesis** está marcado como tal. Los precios de los haras en particular **no están validados con nadie**: este documento define cómo llegar a ellos, no los inventa.

---

## 1. Resumen ejecutivo

1. **Hoy no hay ingreso recurrente verificable.** Las membresías de vet activas se habilitaron a mano; ninguna pasó por MercadoPago. El cobro automático está construido y se probó, pero **falta configurarlo en producción y cerrar el QA**.
2. **El producto tiene tracción real, pero muy concentrada:** un solo cliente reúne la gran mayoría de los caballos, y un solo módulo (Centro de Cría) explica casi toda la actividad reciente. Eso es una buena señal de valor y un riesgo de concentración al mismo tiempo.
3. **El cobro que construimos apunta al segmento que menos plata mueve.** El freemium del vet (gratis hasta 5 caballos propios, $10.000 ARS/mes hasta 25) sí tiene a quién cobrarle, pero la base es mínima: la mayoría de los vets usa la plataforma a través de los caballos de un haras y no tiene caballos propios, y solo unos pocos superan el tope gratuito. El vet es sobre todo el **canal de adquisición**, no la fuente de ingresos.
4. **Para los haras no existe nada para cobrar:** el alta es manual, no hay planes ni límites ni facturación, y la landing dice "los planes se ajustan al tamaño de tu haras — lo vemos en la demo". El "House limit" está en baja prioridad en `TASKS.md`.
5. **Recomendación en una línea:** convertir primero al cliente que ya usa el producto (el cliente ancla) en cliente pago con un contrato anual de "cliente fundador" y facturación manual; construir solo el mínimo de infraestructura de planes para eso; automatizar el cobro recién cuando haya un segundo y tercer haras.
6. **La decisión que destraba todo el modelo** ya está anotada como ticket abierto en `TASKS.md` ("Acceso al centro de embriones"): quién paga el Centro de Cría, ¿el haras, el vet o ambos? Propuesta en §4.3.

**Objetivos tentativos a 90 días (hipótesis, revisar tras la Fase 0):**

| Meta | Valor |
|---|---|
| Cobros reales procesados por MercadoPago en producción | ≥ 1 (propio, de punta a punta) |
| Haras pagando (con contrato y factura) | 1 (el cliente ancla) → 3 |
| Vets en plan pago real (no manual) | 0 → 15 |
| Cobro de haras sin intervención manual | Sí, al cierre de la Fase 2 |

---

## 2. Punto de partida (verificado el 2026-10-01)

### 2.1 Qué muestra el uso real (resumen cualitativo)

Los números se mantienen fuera del repositorio. Las conclusiones que alimentan este plan:

- **Concentración:** un solo cliente reúne la gran mayoría de los caballos activos y casi toda la actividad. El resto de las cuentas son demos o pilotos incipientes.
- **El módulo que se usa es el Centro de Cría:** registros reproductivos y recordatorios automáticos, casi todos recientes. La automatización de recordatorios es el diferencial visible.
- **Uso bajo o nulo** en Sanidad, Torneos y Ventas de caballos: no priorizar nada transaccional ni vender esos módulos como parte del valor sin validarlos.
- **Veterinarios:** la mayoría trabaja sobre caballos de un haras (`acceso_vet`) y no tiene caballos propios, así que el tope del plan gratuito solo aplica a unos pocos.
- **Suscripciones de vet:** las activas se habilitaron manualmente; "activa" no significa "paga". Hay que revisar cuáles son cortesía.
- **Retención de uso:** pocos usuarios activos en 30 días respecto del total de cuentas.
- **Funnel comercial:** los leads de la landing no avanzaron más allá del primer contacto. El tipo `LeadEstado` del front ya admite `demo_agendada`, `demo_realizada`, `convertido` y `perdido`: falta usarlos.

### 2.2 Cautelas al interpretar

El uso reciente puede ser estacional (la camada va de julio a junio, según Gero) o venir de una sola carga masiva. Antes de fijar precios, confirmar con Gero cómo se reparte el uso a lo largo del año.

### 2.3 Qué ya existe para cobrar

| Pieza | Estado |
|---|---|
| Plan gratuito vet (5 caballos propios) y tope pago (25) — `vet_limite_gratuito()` / `vet_limite_pago()` | Hecho |
| Downgrade al vencer (modal bloqueante, baja lógica, reactivación manual) | Hecho, en QA |
| Cobro con MercadoPago (preapproval): `plan_suscripcion_vet`, `pago_veterinario`, Edge Functions `crear-suscripcion-vet` / `cancelar-suscripcion-vet` / `mercadopago-webhook`, 3 días de gracia, idempotencia | Código hecho; **falta configuración en producción y QA** (`docs/specs/mercadopago-setup.md`) |
| Precio editable sin deploy (`plan_suscripcion_vet.precio`, hoy $10.000 ARS/mes) | Hecho |
| Sistema de módulos como feature flags (`cat_modulo`, `sociedad_modulo`, `membresia_modulo`, `usuario_modulo`) | Hecho — **es la base natural de los entitlements por plan** |
| Auditoría append-only de las tablas de plata y permisos (`auditoria`) | Hecho |
| Captura de leads (`lead` + pestaña Leads del superadmin) | Hecho, funnel mínimo |
| Panel superadmin (Empresas, Usuarios, Veterinarios, Leads, Actividad) | Hecho |
| Landing con formulario y WhatsApp | En proceso; faltan capturas reales del producto |

### 2.4 Qué falta

| Hueco | Impacto |
|---|---|
| **Ningún mecanismo de cobro para haras** (planes, vigencia, límites, estado de cuenta) | Bloquea el 90% del ingreso potencial |
| Facturación electrónica / entidad fiscal definida | Sin esto no se puede cobrar formalmente a un haras |
| Revisión legal de T&C y Privacidad (hoy "borrador de referencia", `TASKS.md`) | Gate duro antes de cobrar |
| Emails transaccionales (no hay proveedor; plan con Resend anotado en `BACKEND-API-TASKS.md`, fila 2026-08-15) | Sin avisos de vencimiento ni recibos |
| Jobs programados (nadie recalcula vencimientos si el vet no abre la app) | Estados de suscripción desactualizados |
| Alertas fuera de la app (los recordatorios solo se ven al abrir la app) | Pierde el mayor argumento de valor del Centro de Cría |
| Importador de datos del cliente (la carga del cliente ancla se hizo con migraciones SQL a mano) | Cada cliente nuevo cuesta días de un dev |
| Métricas de negocio (MRR, activación, retención) | Hoy se contesta con SQL a mano |
| Separación demo/producción (las cuentas de demo conviven en la misma base que los clientes reales) | Riesgo operativo y de datos |
| Pricing público | La landing no dice cuánto cuesta |

---

## 3. Modelo de negocio

### 3.1 Quién paga qué

| Segmento | Rol en el negocio | Qué paga | Prioridad |
|---|---|---|---|
| **Haras de cría con programa de embriones** (el perfil del cliente ancla) | **Fuente principal de ingresos** | Suscripción de plataforma + módulo Centro de Cría | 1 |
| Haras de polo / deportivos | Segundo segmento, a validar | Plataforma + módulo Polo (torneos) | 2 |
| **Veterinarios independientes** | **Canal de adquisición** y ingreso chico | Plan Vet Pro (hoy $10.000 ARS/mes) | 3 (ya construido) |
| Propietarios chicos (< 10 caballos) | No es público objetivo hoy: Excel/WhatsApp les alcanza | — | Descartado por ahora |

**Por qué el vet es canal y no negocio:** 30 vets pagando el plan actual suman $300.000 ARS/mes; ese número hay que compararlo con el ticket de un solo haras una vez fijado el pricing (§3.5). Además el tope solo aplica a los vets con clientela propia, que hoy son una minoría. Cada vet que usa la plataforma con los caballos de un haras (`acceso_vet`, planes sanitarios compartidos) empuja al haras a adoptarla. La mecánica ya existe (`compartir_trabajos_con_vet`); falta medirla y empujarla (§5, Fase 3).

### 3.2 Métrica de valor (qué escala el precio)

Opciones, en orden de preferencia:

1. **Caballos activos por tramo + módulos** (recomendada). Es lo que la landing ya anticipa ("se ajusta al tamaño de tu haras"), es fácil de explicar y de medir con una query, y escala con el valor que recibe el cliente. Tramos tentativos a validar: hasta 50 · 51–200 · 201–500 · +500.
2. Por vet/usuario (asientos). Útil como **complemento**: el plan incluye N usuarios y N vets con acceso; los extra se cobran aparte. No como métrica principal: penaliza justo lo que queremos (que el haras sume gente a la plataforma).
3. Por temporada reproductiva en vez de por mes (Centro de Cría). Encaja con la estacionalidad del negocio; dejarlo como variante del contrato anual, no como producto aparte.

### 3.3 Estructura de planes (hipótesis a validar)

| Plan | Incluye | Se cobra |
|---|---|---|
| **Vet Free** | Hasta 5 caballos propios, todo lo básico | Gratis |
| **Vet Pro** | Hasta 25 caballos propios (hoy) | Mensual, ARS (hoy $10.000) |
| **Vet Clínica** *(Fase 3)* | Varios vets bajo una misma cuenta, tope mayor | A definir |
| **Haras Base** | Caballos, historial clínico, sanidad, campos, usuarios y roles, transferencias entre empresas | Por tramo de caballos |
| **+ Centro de Cría** | Embriones, programa semanal, recordatorios, ecografías, transferencias | Adicional al Base |
| **+ Polo** | Torneos y asignación de caballos por jugador | Adicional al Base |
| **Add-ons** | Usuarios extra · alertas por WhatsApp/email · reportes y exportaciones · soporte prioritario | Por unidad / mensual |
| **Servicios (único pago)** | Onboarding e importación de planillas, capacitación a vets | Cargo de implementación |

> Los precios **no están definidos**. El único valor firme es Vet Pro = $10.000 ARS/mes. Para los haras, ver el método en §3.5.

### 3.4 Principios que no se negocian

Salen de las reglas del proyecto (`CLAUDE.md`, `docs/SKILL.md`) y de lo que pasaría con un cliente real en plena temporada:

1. **Nunca se corta el acceso a los datos clínicos por falta de pago.** El historial es inmutable y es el registro médico del animal. El impago degrada a *solo lectura + exportación*, nunca a pérdida o bloqueo de datos.
2. **Los límites de los haras son blandos primero.** Un tope duro que bloquee cargar un registro en medio de un flushing es un daño de confianza que cuesta más que lo que se cobra. Primero se avisa y se factura la diferencia; el bloqueo duro, si llega, aplica solo al alta de *caballos nuevos* tras un período de gracia.
3. **Toda decisión de plata deja rastro.** Las tablas nuevas de facturación entran al trigger `auditar` (grupo "Plata" de `docs/SKILL.md`).
4. **El enforcement vive en la base**, no en el front (misma lección del gate freemium: el front muestra el paywall, la función/policy es la que corta).
5. **Sin PCI:** checkout por redirect, nunca tokenizar tarjetas en nuestro front (decisión ya tomada en la Fase 2 de MercadoPago).

### 3.5 Cómo fijar los precios de los haras (método, no números)

No hay forma honesta de poner un número sin hablar con el cliente. Proceso propuesto para la Fase 1:

1. **Conversación de valor con el cliente ancla y con Gero** (45 min). Preguntas:
   - ¿Cuánto tiempo semanal de vets y encargados ahorra hoy el Centro de Cría? ¿Qué usaban antes (planillas, papel, WhatsApp)?
   - ¿Cuánto cuesta un embrión / una transferencia / una temporada perdida? (ancla de valor)
   - ¿Qué presupuesto anual tienen para software o para el equipo reproductivo?
   - ¿Qué dejarían de usar si el precio fuera X? ¿A partir de qué precio dudan? ¿A partir de cuál les parece sospechosamente barato?
   - ¿Prefieren pagar por mes, por temporada o por año? ¿En pesos o en dólares?
2. **Benchmark** de software equino (gestión de haras, reproducción, veterinaria) y de planillas/consultoría de reproducción que hoy reemplazamos. *Tarea de investigación pendiente: no se pudo verificar ningún precio de competidor desde este entorno, así que no se cita ninguno.*
3. **Precio ancla del cliente fundador:** contrato anual con descuento explícito y compromiso de feedback + caso de éxito. Se documenta como "precio de fundador" para que no quede como el precio de lista.
4. **Revisar a las 5 demos / 3 leads** con la misma estructura de preguntas antes de publicar precios.

### 3.6 Moneda e inflación

- Un preapproval de MercadoPago cobra **el monto fijo con el que se creó** (ya anotado en `BACKEND-API-TASKS.md`, filas 2026-08-13). Con inflación, $10.000 ARS se licúa mes a mes.
- **Propuesta:** lista de precios de haras **en USD**, facturada en ARS al tipo de cambio de referencia que se acuerde en el contrato (a validar con el contador cómo se documenta), con revisión trimestral. Vet Pro se mantiene en ARS, con revisión semestral.
- Hace falta el job que actualice masivamente los preapprovals vivos (`PUT /preapproval/{id}`): hoy no existe y está anotado como trabajo de backend.
- **Los contratos anuales pagados por adelantado** reducen la exposición y mejoran el flujo de caja, y encajan con la estacionalidad.

---

## 4. Decisiones de diseño que hay que cerrar

### 4.1 Mecanismo de entitlements (propuesta técnica)

> ⚠️ **Todo lo que sigue es propuesta.** Según `CLAUDE.md` no se crean tablas ni columnas que no estén en `docs/SKILL.md` sin consultarlo antes, y cada migración tiene que actualizar el SKILL en la misma PR. Nada de esto se creó.

Reusar lo que ya funciona y espejar el patrón de los vets:

```
cat_plan                    -- 'haras_base', 'haras_cria', ... (catálogo, SERIAL, prefijo cat_)
plan_modulo                 -- qué módulos incluye cada plan (puente a cat_modulo)
plan_limite                 -- max_caballos_activos, max_usuarios, max_vets por plan
suscripcion_sociedad        -- una fila vigente por sociedad: plan, estado
                            --   ('trial','activa','vencida','cancelada'), trial_hasta, periodo_hasta,
                            --   precio_acordado, moneda, proveedor_pago ('manual'|'mercadopago'),
                            --   external_subscription_id, notas, activado_por
pago_sociedad               -- auditoría de cobros (mismo rol que pago_veterinario)
```

- **`sociedad_modulo` sigue siendo la fuente de verdad del acceso a un módulo.** Un trigger (o la función de activación) lo sincroniza a partir del plan, para no tocar `get_mis_accesos_modulo()` ni el front.
- Funciones nuevas, `SECURITY DEFINER`, con el mismo cuidado de permisos que las `vet_*` (revocadas de `authenticated` si toman un id por parámetro): `sociedad_suscripcion_vigente(sociedad_id)`, `sociedad_estado_limites(sociedad_id)`.
- **Fase 1 = solo carga manual** por el superadmin (nueva pestaña "Facturación" en `/superadmin`), sin pasarela. Es lo mismo que se hizo con los vets en su Fase 1 y permite cobrar ya.
- **House limit** (hoy baja prioridad en `TASKS.md`) pasa a ser parte de este bloque: contador de caballos activos y usuarios vs. el plan, con aviso en el panel del admin.

### 4.2 Estados de la cuenta y qué se degrada

Propuesta de política de cobro (a validar con Gero y el contador):

| Estado | Cuándo | Qué ve el cliente | Qué se restringe |
|---|---|---|---|
| `trial` | Primeros 30 días | Banner con días restantes | Nada |
| `activa` | Período pago | — | Nada |
| Gracia | Hasta N días tras el vencimiento (propuesta: 15) | Aviso por email y en la app | Nada |
| `vencida` | Pasada la gracia | Modo solo lectura + exportación de datos | No se pueden cargar caballos nuevos ni registros; **sí se puede ver y exportar todo** |
| `cancelada` | Baja pedida | Acceso hasta fin del período; luego solo exportación por un plazo definido | Datos se conservan según los T&C |

### 4.3 La decisión clave: ¿quién paga el Centro de Cría?

Ticket abierto en `TASKS.md` ("Acceso al centro de embriones"). Hoy los datos del Centro de Cría están **centrados en el vet** (`cria_plazo_vet`, `cat_chip_obs`, `cria_regla_recordatorio`, días de revisión: todo configurable por el vet, por pedido de Gero), pero el contrato comercial lo pagaría un haras.

| Opción | Cómo funciona | A favor | En contra |
|---|---|---|---|
| **A. Paga el haras** | El módulo se habilita por `sociedad_modulo`; los vets con `acceso_vet` lo usan gratis | Un solo pagador, ticket mayor, el vet es campeón del producto | Un vet que atiende varios haras depende de que cada uno pague |
| **B. Paga el vet** | Se habilita por `usuario_modulo` | Escala con la cantidad de vets | Ingreso chico; el haras no tiene incentivo; fricción con la gente que ya lo usa |
| **C. Híbrido** *(recomendada)* | Acceso al Centro de Cría = el haras del caballo tiene el módulo **o** el vet tiene Vet Pro | Haras paga por su programa; el vet independiente paga por su clientela propia | Hay que definir qué cuenta como "clientela propia" y evitar que un vet "revenda" acceso |

**Recomendación: C**, con el plan del haras incluyendo un número de vets con acceso (asientos) y cobro adicional por vets extra. Es compatible con el modelo ya construido: `acceso_vet` define con quién trabaja el vet; el módulo define qué puede usar.

> Esta decisión no la puedo tomar yo: es comercial. Hay que cerrarla con Gero antes de armar el contrato de la Fase 1.

---

## 5. Roadmap por fases

Estimaciones de esfuerzo **gruesas** (S ≈ 1–2 días · M ≈ 3–5 · L ≈ 1–2 semanas, por dev). Con dos devs y trabajo compartido con el resto del producto, los plazos son orientativos. Los responsables quedan sin asignar, como en `TASKS.md`.

### Fase 0 — "Poder cobrar algo real" · semanas 1–2

**Objetivo:** primer cobro real de punta a punta y los requisitos mínimos para cobrarle a un cliente sin exponerse.

*No es código (empezar ya, tiene más tiempo de espera que de trabajo):*
- [ ] **Entidad fiscal y facturación.** Definir con un contador desde qué entidad se factura, qué comprobante corresponde y cómo se documenta una tarifa en USD. Sin esto no se cierra la Fase 1.
- [ ] **Revisión legal** de `/legales/terminos` y `/legales/privacidad` (hoy borrador): agregar cláusulas de suscripción, cancelación, devolución de datos, conservación del historial clínico y Ley 25.326. Es un gate duro.
- [ ] **Cuenta de MercadoPago de la empresa** (la que va a recibir la plata) y credenciales de producción.
- [ ] Conversación de valor con Gero (§3.5) y definir pricing v0.
- [ ] Investigar competidores y alternativas locales (tarea pendiente, §3.5).

*Técnico:*
- [ ] **Terminar la Fase 2 de MercadoPago** siguiendo `docs/specs/mercadopago-setup.md` (pasos 1–10): secrets, deploy de las 3 funciones (`--no-verify-jwt` en el webhook), webhook con la URL completa, prueba end-to-end con el checklist de `QA.md`, pasaje a producción y **un cobro real propio**. *(S–M)*
- [ ] Auditar las suscripciones activadas manualmente: marcar cuáles son cortesía (`notas`, `proveedor_pago = 'manual'`) y cuáles deberían migrar a MercadoPago. *(S)*
- [ ] **Infra de producción:** pasar Supabase a un plan con backups diarios/PITR y sin pausa por inactividad; revisar si Vercel requiere plan comercial para el uso real (el plan gratuito de Vercel es para uso no comercial: verificar sus términos vigentes); SMTP propio (el de Supabase por defecto es limitado y pensado para pruebas: verificar límites vigentes) con dominio verificado; monitoreo de errores. *(M)*
- [ ] **Separar demo de producción:** hoy las cuentas de demo conviven con los clientes reales. Opciones: proyecto de staging aparte o branch de Supabase. *(M)*
- [ ] Registrar el avance de cada lead por el funnel (el tipo `LeadEstado` ya admite `demo_agendada`, `demo_realizada`, `convertido`, `perdido`; verificar que la base no tenga un CHECK que lo impida). *(S)*
- [ ] **Completar la revisión de seguridad y de calidad antes de sumar usuarios nuevos.** El detalle de los hallazgos se gestiona fuera del repositorio público. Cada migración o Edge Function nueva se prueba primero en un entorno aparte y requiere aprobación antes de tocar producción. *(M–L)*
- [ ] Corregir `mercadopago-setup.md`: los ejemplos dicen $25.000 pero el precio vigente es $10.000, y afirma que no hay botón de baja cuando `MembresiaVetCard` ya lo tiene. *(S)*

**Criterio de salida:** un pago real aprobado por MercadoPago en producción que activó una suscripción solo; T&C y Privacidad revisados y publicados; backups verificados; demo separada de producción; revisión de seguridad completada y hallazgos críticos corregidos o descartados con evidencia.

---

### Fase 1 — "Primer haras pago (cliente ancla)" · semanas 2–6

**Objetivo:** que el cliente que ya usa el producto empiece a pagar, con el mínimo desarrollo necesario. La ventana es ahora: el Centro de Cría está en uso intenso y es cuando mejor se ve el valor.

- [ ] **Propuesta comercial y contrato anual de cliente fundador** (precio fundador, alcance, soporte, qué pasa con los datos). Facturación y cobro **manuales** (transferencia). *(no es código)*
- [ ] **Cerrar la decisión de §4.3** (quién paga el Centro de Cría) antes de redactar el contrato.
- [ ] Migraciones de §4.1: `cat_plan`, `plan_modulo`, `plan_limite`, `suscripcion_sociedad`, `pago_sociedad` + actualización de `docs/SKILL.md` + alta en `auditar`. *(M)*
- [ ] Pestaña **"Facturación"** en `/superadmin`: asignar plan a una sociedad, vigencia, monto acordado, notas, registrar pagos manuales. *(M)*
- [ ] **Límites blandos** (House limit): contador de caballos activos/usuarios vs. el plan en el panel del admin, aviso al acercarse. *(M)*
- [ ] Banner de estado de cuenta para el admin (trial, vence en N días, vencida). *(S)*
- [ ] **Métricas de negocio** en el superadmin, derivadas de la base (vistas SQL + una pestaña "Métricas"): MRR, haras activos, caballos activos, usuarios activos 30d, registros por módulo, activación por sociedad. Sin sumar dependencias de analytics: la base ya tiene lo necesario (`auditoria`, `superadmin_actividad_usuarios()`). *(M)*
- [ ] **Higiene de producto que un cliente pago espera** (ya existen como tickets): *Cambiar contraseña*, *Accesos* (el admin gestiona), cerrar el QA de *Definir roles y membresías*. *(S–M)*
- [ ] **Importador de planillas** (Excel/CSV) para altas de caballos. El proyecto ya usa `xlsx`. Hoy cada carga es una migración SQL hecha a mano. *(L — empezar el diseño acá, terminar en Fase 2)*

**Criterio de salida:** el cliente ancla con contrato firmado y primer período cobrado y facturado; sus límites y su estado de cuenta visibles en la app; métricas básicas funcionando.

---

### Fase 2 — "Cobro automático y 3–5 haras" · semanas 6–14

**Objetivo:** que cobrar y renovar no dependa de que alguien se acuerde, y sumar clientes sin que cada alta cueste días de desarrollo.

- [ ] **Cobro automático de haras:** MercadoPago (preapproval, mismo flujo que vets) para los planes chicos; transferencia + factura para los grandes. Evaluar un medio para cobrar en USD **solo si** aparece un cliente que lo necesite. *(L)*
- [ ] **Emails transaccionales** con Resend (falta cuenta/dominio verificado y `RESEND_API_KEY` como secret): bienvenida, recibo, aviso de vencimiento, falla de cobro. El plan técnico ya está anotado (trigger sobre `notificacion` → `pg_net` → Edge Function `enviar-notificacion`). *(M)*
- [ ] **Jobs programados** (`pg_cron` o Edge Function agendada): barrer vencidos, aplicar gracia y degradación (§4.2), reprecio masivo de preapprovals, limpiar preapprovals abandonados. *(M)*
- [ ] **Facturación electrónica**: automatizarla con un proveedor o integración, según lo que indique el contador. *(M–L)*
- [ ] **Funnel comercial:** landing con precios y capturas reales (pendiente en `TASKS.md`), pipeline de leads con los estados nuevos, y demo reproducible con el entorno separado. *(M)*
- [ ] **Alertas fuera de la app** (email/WhatsApp) para recordatorios del Centro de Cría: hoy solo se ven al abrir la app. Candidato a add-on pago y a herramienta de retención. *(L; el costo por mensaje de WhatsApp hay que verificarlo antes de ponerle precio)*
- [ ] **Terminar el importador de planillas** y convertirlo en parte del onboarding. Mientras no esté, cobrar el onboarding como servicio. *(L)*
- [ ] Reprecio de Vet Pro y revisión de límites con datos reales de uso.

**Criterio de salida:** ≥ 3 haras pagos (al menos uno distinto del cliente ancla), cobro y renovación sin intervención manual, MRR medido, onboarding en menos de un día de trabajo.

---

### Fase 3 — "Subir el ticket y la retención" · meses 4–8

- [ ] **Loop vet → haras:** medir cuántos haras entran por un vet que ya los usa; botón "Invitar a mi haras / a mi veterinario"; programa de referidos con crédito.
- [ ] **Vet Clínica:** varios vets bajo una cuenta, con facturación única.
- [ ] **Reportes y exportaciones** pagos: parte diario del vet (Gero lo dejó "para más adelante"), fichas en PDF, estadísticas por temporada.
- [ ] **Uso sin conexión / PWA** (hoy en el roadmap de la landing): relevante en campo, donde no hay buena conexión.
- [ ] **Polo/Torneos v2** *solo si* se confirma el segmento: disponibilidad por lesión, límites por jugador, resultados (ya anotados en `TASKS.md`). Hoy casi no hay uso: no invertir sin cliente.
- [ ] **Sanidad:** revisar por qué casi no se usa antes de venderla como parte del valor.
- [ ] **Backend FastAPI:** ver §7.

### Fase 4 — Opcional, solo con tracción

Multi-país y multi-moneda (el SKILL contempla "más países"), integraciones con registros genealógicos, marketplace de venta de caballos (hoy sin uso: **no** construir antes de ver demanda).

---

## 6. Métricas y puntos de decisión

### 6.1 Qué medir (todo derivable de la base, sin herramientas nuevas)

| Métrica | Cómo | Para qué |
|---|---|---|
| MRR / ARR | `suscripcion_sociedad` + `suscripcion_veterinario` activas × precio | Avance real |
| Haras activos y caballos activos | Conteo por sociedad | Tamaño del negocio y tramo de precio |
| Activación | % de sociedades nuevas que cargan caballos **y** su primer registro en 14 días | Si el onboarding funciona |
| Retención de uso | Usuarios con login en 30 días / usuarios activos | Es el número a mover |
| Conversión vet Free → Pro | Vets que pagan / vets registrados | Efectividad del tope |
| Conversión de leads | Leads por estado del funnel | Calidad del canal |
| Churn y motivo | Bajas por período, con campo de motivo | Qué corregir |
| Tiempo de onboarding | Horas de dev por cliente nuevo | Costo oculto |

### 6.2 Reglas de decisión (para no seguir por inercia)

- **Fin de Fase 1** sin contrato firmado con el cliente ancla → revisar la propuesta de valor y el precio antes de construir nada más.
- **Fin de Fase 2** sin un segundo haras pago → revisar el cliente ideal: ¿es un problema de producto, de precio o de canal?
- **Cualquier fase:** si más del 50% del MRR depende de un solo cliente, la prioridad pasa a ser diversificar antes de agregar funcionalidades.

---

## 7. Impacto en el backend (`docs/BACKEND-API-TASKS.md`)

El **Bloque 0** dice que alcanza con que se cumpla *un* disparador para arrancar el backend FastAPI. Con este plan se cumplen dos:

- **Secretos que no pueden vivir en el navegador:** cobro de haras, facturación electrónica, mails transaccionales.
- **Jobs programados:** vencimientos, gracia, reprecio, avisos.

**Recomendación:** no arrancar el backend por eso todavía. Hasta la Fase 2 alcanza con Edge Functions + `pg_cron`, que es lo que ya se usa para MercadoPago. Arrancar el Bloque 1 cuando se dé alguna de estas señales: la facturación electrónica requiere certificados o librerías que no corren cómodas en Deno, hay más de ~3 integraciones de terceros con estado propio, o los jobs necesitan reintentos/colas que `pg_cron` no da bien. Cuando se implemente cada pieza, anotarla en la tabla "Registro de tasks pendientes de backend" (regla de `CLAUDE.md`):

- Servicio de suscripciones de sociedades (equivalente a las funciones `mp_*`).
- Job de vencimiento, gracia y degradación.
- Reprecio masivo de preapprovals.
- Emisión de factura electrónica y envío del recibo.
- Cola de envío de emails/WhatsApp con reintentos.

---

## 8. Costos y márgenes (a verificar)

Costos fijos esperables al pasar a producción real. **Ningún monto está verificado acá**: confirmar en cada proveedor antes de calcular el punto de equilibrio.

| Concepto | Nota |
|---|---|
| Supabase (plan con backups/PITR, sin pausa) | Necesario antes de cobrar |
| Vercel (plan comercial si corresponde) | Verificar términos del plan actual |
| Resend (emails) y dominio | Falta cuenta y dominio verificado |
| Monitoreo de errores | Hoy no hay |
| Comisión de MercadoPago + IVA sobre cada cobro | Verificar tasa vigente |
| Contador + abogado (puntual) | Fase 0 |
| WhatsApp (si se ofrece como add-on) | Cobra por conversación/mensaje: verificar antes de fijar precio |
| **Tiempo de los devs** | El costo mayor. Medir horas de soporte y de onboarding por cliente |

**Cálculo a completar tras la Fase 0:** `margen = ingreso mensual − (infra + comisiones + horas de soporte × costo hora)`. Con 2 devs, el soporte es la variable que más puede comerse el margen: incluir en cada plan qué nivel de soporte tiene y cobrar aparte el prioritario.

---

## 9. Riesgos y mitigaciones

| Riesgo | Detalle | Mitigación |
|---|---|---|
| **Concentración en un cliente** | Un solo cliente reúne la gran mayoría de los caballos y de la actividad | Contrato anual; priorizar un segundo haras; regla de §6.2 |
| **Roadmap dictado por un solo cliente** | Las reuniones y tickets vienen casi todos de Gero | Validar cada pedido grande con 2–3 haras más antes de construirlo |
| **Inflación / ARS** | Preapproval de monto fijo se licúa | Lista en USD para haras, contratos anuales, job de reprecio (§3.6) |
| **Legal y datos personales** | T&C en borrador; se guardan DNI de vets e historiales clínicos | Revisión legal en Fase 0 como gate duro; no cobrar antes |
| **Seguridad multi-tenant** | Hubo un fix de RLS de `lead` y Storage el 2026-09-26; el registro de vets es público | Completar la revisión de seguridad antes de la Fase 1 (el detalle se gestiona fuera del repositorio público) y correr una matriz de tests de aislamiento entre sociedades |
| **Estacionalidad** | Uso y valor percibido cambian a lo largo del año | Contratos anuales o por temporada; no medir churn mensual en baja temporada sin ajustar |
| **Un solo entorno** | Demos y cliente real en la misma base | Staging separado (Fase 0) |
| **Soporte desbordado con 2 devs** | Cada cliente nuevo cuesta horas | Importador, ayuda y tooltips (ticket en proceso), niveles de soporte por plan |
| **Cuello de botella de dinero** | Cobro y facturación dependen de pasos manuales | Fase 2 los automatiza; mientras tanto, un solo responsable por cobro |
| **Cobros mal configurados** | Ya pasó: webhook sin ruta, `APP_URL` en localhost, usuarios de prueba mezclados | Seguir la guía de errores de `mercadopago-setup.md` y hacer el pasaje a producción con un cobro real propio |

---

## 10. Decisiones y datos que necesito de ustedes

1. **¿Quién paga el Centro de Cría?** (§4.3: opción A, B o C). Es la que más condiciona el modelo.
2. **¿Las suscripciones de vets activadas manualmente** son cortesía o alguien paga por fuera? Define si hay ingreso hoy y a quién migrar a MercadoPago.
3. **¿Hay clientes de polo reales**, o es una hipótesis? Define si "Polo" es un segmento o un módulo a validar.
4. **¿Qué entidad factura** y qué comprobante corresponde? (con el contador)
5. **¿Cuál es el estado real de las credenciales de MercadoPago** (prueba vs. producción) y de la cuenta de la empresa?
6. **¿Se acepta cobrar en USD** a los haras, o solo en ARS con revisión periódica?
7. **¿Cuál es la política de impago que están dispuestos a sostener?** (§4.2: propuesta con gracia de 15 días y solo lectura)
8. **¿Quién queda a cargo de cada bloque?** `TASKS.md` marca todo como sin asignar.
9. **¿Hay precio mínimo aceptable** para el cliente fundador, o se define tras la conversación con Gero?

---

## 11. Qué NO hacer

Coherente con `CLAUDE.md` y con lo ya decidido:

- No construir un backend Express, ni arrancar FastAPI sin cumplir lo del §7.
- No agregar herramientas de analytics o de facturación como dependencia del front sin verificar que Supabase no lo resuelve.
- No tokenizar tarjetas en nuestro front (PCI).
- No bloquear nunca el acceso a datos clínicos por falta de pago.
- No construir marketplace, ventas ni funcionalidades transaccionales sin demanda.
- No cobrar a ningún cliente antes de tener los T&C y la Privacidad revisados.
- No hardcodear precios, tramos ni límites: viven en tablas editables por el superadmin (como `plan_suscripcion_vet`).
- No agregar una sección "Transferencias" en la página de Caballos (regla vigente).

---

## 12. Inconsistencias encontradas en la documentación (para corregir)

| Dónde | Qué pasa |
|---|---|
| `docs/specs/mercadopago-setup.md` (pasos 6, 9 y 10) | Los ejemplos usan $25.000 ARS; el precio vigente es $10.000 (migración `20260903225400`) |
| `docs/specs/mercadopago-setup.md` ("Cosas que conviene tener claras") | Dice que no hay botón de baja en HarasManager; `MembresiaVetCard` ya llama a `cancelar-suscripcion-vet` |
| `docs/specs/roles-freemium-veterinarios.md` | Define que la suscripción desbloquea caballos propios **ilimitados**; el SKILL y las migraciones `20260813120200`/`20260813120300` ya lo cambiaron a un tope pago de 25 |
| `TASKS.md` | El ticket "Cobro de la membresía del vet con MercadoPago (Fase 2)" figura `falta configuración + QA` pero está marcado `[x]` |
| `QA.md` (usuarios de prueba) | Referencias a "marca", modelo abandonado según el SKILL |
| `CLAUDE.md` | Dice "sin producción aún" y pide `VITE_SUPABASE_ANON_KEY`; la app ya está en producción y el código usa `VITE_SUPABASE_ANON` |

---

## 13. ¿Publicidad pagada ahora?

**Veredicto: todavía no, y para este negocio probablemente no como primer canal.** Es una opinión basada en lo que muestran el repo y los datos de la §2; no hay datos de mercado en este documento (cuántos haras y vets reproductores hay, costo de un lead en estos nichos), y eso es lo primero que habría que averiguar.

### Por qué no ahora

1. **Todavía no hay nada que cobrarle a quien llegue.** Sin precio publicado, sin contrato, sin facturación y con T&C en borrador, un lead pago no se puede convertir en ingreso.
2. **Hoy no se puede medir una campaña.** No hay analytics ni pixel en el front, la landing no distingue de dónde viene cada visita, y el formulario no pide consentimiento. Sin atribución, el gasto es a ciegas.
3. **La landing no está lista para tráfico móvil.** El video del hero pesa 5,3 MB sin imagen de carga, el favicon pesa 1,5 MB, la vista previa al compartir por WhatsApp/redes puede no mostrar imagen (`og:image` relativa) y todo se renderiza en el cliente. El video y el favicon se pueden optimizar sin tocar la lógica de la app.
4. **El formulario está abierto al spam** (sin captcha ni honeypot): con tráfico pago, los leads falsos llegan primero.
5. **Traer usuarios nuevos antes de completar la revisión de seguridad multiplica la exposición.** El registro de vets es público.
6. **No hay capacidad de atender un alta masiva.** Los haras se dan de alta a mano y cada carga de datos fue una migración SQL: cada lead convertido cuesta días de un dev, y son dos.
7. **La retención todavía no está probada** (pocos usuarios activos en 30 días; un solo cliente concentra el uso). Pagar por adquirir antes de saber si se retiene es comprar churn.

### Por qué probablemente no es el mejor canal en este mercado

El comprador es un grupo chico y de relaciones: haras de cría y polo, y veterinarios de reproducción. En un nicho así suele rendir más (a validar) **la venta directa, las referencias de Gero y de los vets, las demos y la presencia en jornadas y eventos del sector** que una campaña de alcance masivo. El propio producto ya tiene un canal interno: el vet que comparte planes y accesos con un haras.

Para los vets, el registro ya es *self-serve* (`/registro-veterinario`), pero el plan cuesta $10.000 ARS/mes: el costo por cliente adquirido tendría que ser muy bajo para recuperarse. Tiene más sentido tratar al vet como puerta de entrada a los haras que como un cliente a captar con anuncios.

### Cuándo sí (condiciones para empezar)

- [ ] Revisión de seguridad completada y hallazgos críticos corregidos o descartados.
- [ ] Precios publicados, contrato y T&C/Privacidad revisados, facturación resuelta (Fase 0 y 1 de este plan).
- [ ] Al menos **un haras pagando y un caso de éxito** que se pueda mostrar (con permiso del cliente).
- [ ] Onboarding de un cliente nuevo en **menos de un día de trabajo** (importador de planillas).
- [ ] Landing optimizada para móvil, con capturas reales del producto, analytics con consentimiento, captcha/honeypot y casilla de aceptación en el formulario.
- [ ] Pipeline de leads registrado en el panel (`lead.estado`) para medir lead → demo → pago.

### Cómo probarlo cuando llegue el momento

- **Presupuesto chico, con tope fijo y por tiempo limitado** (por ejemplo 4–6 semanas), decidido de antemano; no escalar por clics sino por **costo por demo realizada**.
- Empezar por **búsqueda con intención** (quien ya busca "software de gestión de haras" o "programa de reproducción equina") y una prueba chica en redes con audiencias del rubro; verificar cuáles canales usa realmente el público objetivo antes de repartir presupuesto.
- Métricas de corte: costo por lead, lead → demo, demo → pago, y **CAC frente al ingreso mensual por cliente** (si el CAC no se recupera en el plazo que defina el equipo, se frena).
- Mientras tanto, con costo casi nulo: casos de éxito, contenido útil para veterinarios (por ejemplo, calendarios y checklists de la temporada reproductiva), presencia en grupos del rubro y un programa de referidos.
