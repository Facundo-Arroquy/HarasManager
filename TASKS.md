# TASKS — HarasManager

> Actualizar este archivo cuando se empiece o termine un ticket.
> Antes de arrancar una tarea, verificar que nadie más la tenga asignada.

## Cómo usar

- **Estado:** `pendiente` | `en proceso` | `QA` | `terminado`
- **Prioridad:** `alta` | `media` | `baja`
- **Asignado:** nombre del dev, o `-` si no está asignado aún

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
- **Estado:** pendiente
- **Asignado:** -
- **Descripción:** Landing pública con "quiénes somos", qué ofrecemos, etc.

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
