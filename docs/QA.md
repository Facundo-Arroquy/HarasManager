# QA Checklist — HarasManager

> **Cómo usar este archivo**
> - Antes de mergear a `main`: correr los checks del módulo que tocaste
> - Antes de la demo: correr el checklist completo de arriba a abajo
> - Marcar con `[x]` los que pasan, `[!]` los que tienen problema
> - Si algo falla, abrir un ticket en `TASKS.md` antes de mergear

---

## Usuarios de prueba

> Las contraseñas están en el archivo de accesos local (no está en el repo).

### Haras Demo 1
| Email | Rol | Qué debe ver |
|-------|-----|--------------|
| admin.demo1@haras.com | admin | Todo el establecimiento |
| vet.demo1@haras.com | veterinario | Solo caballos con acceso concedido |
| jugador.demo1@haras.com | jugador | Solo caballos de su marca |
| piloto.demo1@haras.com | piloto | Solo caballos de su marca |
| peticero.demo1@haras.com | peticero | Solo caballos de su marca |

### Haras Demo 2
| Email | Rol | Qué debe ver |
|-------|-----|--------------|
| admin.demo2@haras.com | admin | Todo el establecimiento |
| vet.demo2@haras.com | veterinario | Solo caballos con acceso concedido |
| jugador.demo2@haras.com | jugador | Solo caballos de su marca |
| piloto.demo2@haras.com | piloto | Solo caballos de su marca |
| peticero.demo2@haras.com | peticero | Solo caballos de su marca |

### SuperAdmin
| Email | Rol |
|-------|-----|
| superadmin@haras.com | superadmin |

---

## 1. Autenticación

### Login
- [ ] Login con credenciales incorrectas muestra error "Credenciales incorrectas"
- [ ] Login con credenciales correctas redirige según rol:
  - [ ] `admin` → `/dashboard`
  - [ ] `veterinario` → `/panel-vet`
  - [ ] `jugador` / `piloto` / `peticero` → `/dashboard`
  - [ ] `superadmin` → panel superadmin
- [ ] Usuario ya logueado que entra a `/` es redirigido correctamente (no vuelve al login)
- [ ] Logout cierra sesión y redirige al login

### Términos y condiciones
- [ ] Usuario que no aceptó los términos ve el modal al entrar
- [ ] Usuario que ya aceptó no ve el modal

---

## 2. Caballos

### Listado
- [ ] Admin haras ve todos los caballos del establecimiento
- [ ] Admin marca ve solo los caballos de su marca
- [ ] Veterinario ve solo los caballos con acceso concedido
- [ ] Filtro por categoría funciona (Todos / Caballo / Yegua / Padrillo / Potrillo)
- [ ] Búsqueda por nombre filtra correctamente
- [ ] Spinner aparece mientras carga

### Alta de caballo
- [ ] Solo admin puede crear caballo (botón `+` no aparece para otros roles)
- [ ] Formulario valida campos requeridos (nombre, categoría, raza, pelaje)
- [ ] Caballo creado aparece en el listado inmediatamente

### Edición
- [ ] Admin puede editar datos del caballo
- [ ] Cambio de categoría (Donante / Receptora) se guarda correctamente
- [ ] Cambio de campo (potrero) se guarda correctamente

### Detalle e historial
- [ ] Click en caballo abre el detalle / ficha
- [ ] Se muestra: nombre, categoría, raza, pelaje, edad, chip, registro
- [ ] Se muestra el historial clínico del caballo
- [ ] Árbol genealógico se renderiza sin errores
- [ ] Foto del caballo se muestra (o placeholder si no tiene)

---

## 3. Historial Clínico

### Crear consulta
- [ ] Solo veterinario ve el botón para agregar consulta
- [ ] Modal de nueva consulta se abre correctamente
- [ ] Guardar consulta la agrega al historial sin recargar la página
- [ ] Consulta guardada muestra: fecha, tipo, diagnóstico, tratamiento

### Permisos de edición
- [ ] Veterinario puede editar solo sus propias consultas
- [ ] Otro veterinario NO puede editar consultas ajenas
- [ ] Admin puede ver el historial pero NO editarlo

### Exportar ficha
- [ ] Botón de imprimir / exportar PDF genera el archivo correctamente

---

## 4. Centro de Embriones

> ⚠️ Solo accesible si la sociedad tiene `acceso_centro_cria = true`

### Acceso
- [ ] Usuario sin acceso al centro NO ve el grupo "Centro de Embriones" en el menú
- [ ] Usuario con acceso ve las secciones: Panel reproductivo, Programa semanal, Recordatorios, Flushings, Transferencias de embriones

### Panel reproductivo
- [ ] Carga sin errores para admin y para veterinario
- [ ] Muestra resumen de recordatorios de hoy
- [ ] Muestra recordatorios vencidos
- [ ] Muestra recordatorios próximos 7 días
- [ ] Botón `+` abre el modal de registro clínico

### Registro clínico reproductivo
- [ ] Se puede seleccionar una donante o receptora (bug conocido: fix pendiente)
- [ ] Chips de ovario izquierdo, derecho y útero se seleccionan correctamente
- [ ] Chips de observaciones (Strelin, IN, OXI, PG, etc.) funcionan
- [ ] Al guardar se generan los recordatorios automáticos según las reglas:
  - [ ] Donante + Strelin → recordatorio IN en +1 día
  - [ ] Donante + IN → recordatorio OXI en +1 día
  - [ ] Donante + OV → recordatorio Flushing en +6 días
  - [ ] Donante + PG → recordatorio Revisión PG en +3 días
  - [ ] Receptora + Strelin → recordatorio Revisión Strelin próximo Lun/Mié/Vie
  - [ ] Receptora + PG → recordatorio Revisión PG en +4 días

### Recordatorios
- [ ] Filtros (Todos / Pendientes / Vencidos / Hechos / Cancelados) funcionan
- [ ] Marcar como "Hecho" un recordatorio tipo Flushing abre el modal de flushing
- [ ] Marcar como "Hecho" otros tipos actualiza el estado correctamente
- [ ] Cancelar recordatorio pide confirmación y lo marca como cancelado
- [ ] Recordatorios vencidos se marcan automáticamente cada 60 segundos

### Flushings
- [ ] Lista de flushings carga correctamente
- [ ] Se puede registrar un nuevo flushing
- [ ] Flushing negativo se registra correctamente

### Transferencias de embriones
- [ ] Lista de transferencias carga correctamente
- [ ] Se puede registrar una nueva transferencia
- [ ] Receptora, donante y padrillo se seleccionan correctamente

### Programa semanal
- [ ] Se muestra la semana actual correctamente
- [ ] Los animales con actividad aparecen en el día correcto

---

## 5. Panel Veterinario

- [ ] `/panel-vet` carga sin errores
- [ ] Muestra cantidad de caballos con acceso
- [ ] Muestra consultas recientes
- [ ] Muestra alertas vigentes
- [ ] Click en caballo navega al historial correctamente
- [ ] Revisión pre-venta carga y funciona
- [ ] Transferencia entre empresas funciona

### Veterinario independiente / freemium
- [ ] Alta de vet independiente end-to-end desde `/registro-veterinario` (signup + T&C + confirmación de email + login)
- [ ] Crear 5 caballos propios (sin sociedad): ok
- [ ] Intentar crear el 6to sin suscripción activa: bloqueado, mensaje de paywall (no un error genérico de Postgres)
- [ ] Superadmin activa la suscripción (`/superadmin` → Veterinarios) → el mismo vet ya puede crear el 6to
- [ ] Un vet con acceso clínico otorgado en un haras (`acceso_vet`) que además tiene caballos propios: ve ambos contextos sin que se mezclen (caballos propios + los que tiene acceso clínico)

**Downgrade (caer del plan pago al gratuito)**
- [ ] Vet con suscripción activa y 8 caballos propios: entra normal, sin modal
- [ ] Superadmin le desactiva la suscripción → al volver a entrar aparece el modal bloqueante, y no hay forma de cerrarlo ni de navegar a otra ruta
- [ ] El modal lista **solo** los caballos propios: los de haras a los que tiene acceso clínico no aparecen
- [ ] El botón "Dar de baja" queda deshabilitado hasta que la selección deje 5 o menos; el contador indica cuántos faltan
- [ ] Confirmar las bajas → el modal desaparece y el vet puede usar la app
- [ ] Los caballos dados de baja no aparecen más en `/panel-vet` ni en el listado de caballos
- [ ] Sus alertas de próxima consulta tampoco aparecen más en el panel
- [ ] El historial clínico de esos caballos **no** se borró (verificar en la base, no hay UI para verlos)
- [ ] Después de regularizar, el vet puede volver a crear un caballo hasta llegar de nuevo a 5
- [ ] Un vet con 5 o menos caballos propios y sin suscripción: nunca ve el modal
- [ ] Un admin de haras o un superadmin: nunca ve el modal (el chequeo solo corre para `rol = 'veterinario'`)
- [ ] "Retomar membresía" está habilitado y muestra el precio del plan (ej. `Retomar membresía — $25.000/mes`)

**Reactivación de caballos dados de baja**
- [ ] Tras dar de baja, aparece la sección "Dados de baja" en `/panel-vet` con los caballos y su fecha de baja
- [ ] Un vet sin caballos dados de baja no ve la sección (no debe quedar una tarjeta vacía)
- [ ] Con el plan gratuito lleno (5 activos): el aviso explica que hay que dar de baja otro o activar la membresía, y los checkboxes quedan bloqueados
- [ ] Con cupo libre (ej. 4 activos): se puede reactivar 1; seleccionar 2 avisa "solo podés reactivar 1" y el botón queda deshabilitado
- [ ] Con suscripción activa: se pueden reactivar todos de una
- [ ] Al reactivar, el caballo vuelve al listado y al contador del panel, con su historial clínico intacto
- [ ] El acceso clínico del vet sobre el caballo reactivado sigue funcionando (se puede abrir su historial y cargar una consulta)

**Suscripción con MercadoPago**

> Requiere la configuración de `docs/specs/mercadopago-setup.md` hecha en modo
> prueba, y los usuarios de prueba de MercadoPago creados.

- [ ] El sidebar del vet muestra **Configuración** al pie, arriba de "Cerrar sesión", y al desplegarlo aparece **Suscripción**
- [ ] Un admin, jugador, piloto o peticero **no** ve el menú Configuración del vet en el sidebar
- [ ] Lo mismo en mobile: el menú aparece dentro del drawer y al tocar "Suscripción" el drawer se cierra
- [ ] Entrar a `/config-vet` redirige a `/config-vet/suscripcion`
- [ ] `/config-vet/suscripcion` muestra la tarjeta "Membresía" con la etiqueta gris **Plan gratuito** y el botón `Suscribirme — $X/mes` con el precio real de `plan_suscripcion_vet`
- [ ] Un admin de haras o un superadmin que entre por URL directa a `/config-vet/suscripcion` no ve la tarjeta (no tienen fila de suscripción)
- [ ] Clic en "Suscribirme" abre el checkout de MercadoPago con el nombre del plan y el importe correctos
- [ ] Pagando con tarjeta de prueba y titular `APRO`, vuelve a `/suscripcion/resultado` mostrando "Confirmando tu pago" y en segundos cambia a **Membresía activa**
- [ ] La tarjeta del panel pasa a **Activa** y muestra la fecha de renovación
- [ ] En la base: `suscripcion_veterinario.estado = 'activa'`, `external_subscription_id` cargado, y una fila en `pago_veterinario` con `estado = 'approved'`
- [ ] Con la membresía activa, el vet puede crear más de 5 caballos propios
- [ ] Con la membresía activa, al llegar a **25** el alta se bloquea y el cartel dice que es el máximo de la membresía, con un link **"Comunicarme con soporte"** que abre el mail — **no** debe ofrecer activar nada
- [ ] Con el plan gratuito lleno (5), el cartel del alta sigue siendo el de siempre: invita a activar la membresía, sin link de soporte
- [ ] La tarjeta de membresía muestra el conteo real ("Estás usando 7 de 25 caballos") y no un número escrito a mano
- [ ] Un vet con membresía que supere los 25 (dándose de alta antes del tope) ve el modal bloqueante con el texto de membresía, **sin** el botón de pago — no tiene sentido venderle lo que ya tiene
- [ ] Reactivar caballos con membresía activa respeta el tope de 25 (antes con suscripción se podían reactivar todos)
- [ ] Abandonar el checkout sin pagar deja la suscripción en `'pendiente'`, la tarjeta dice "Pago pendiente" y el vet **no** obtiene acceso ilimitado
- [ ] Abandonar el checkout y volver a tocar "Suscribirme": en MercadoPago tiene que quedar **una sola** suscripción viva. La anterior debe figurar `cancelled` (verificar con `GET /preapproval/search?external_reference=<usuario_id>`)
- [ ] El `init_point` viejo, después de reintentar, ya no permite pagar
- [ ] Con la membresía activa, tocar "Suscribirme" de nuevo no crea un segundo cobro (la función responde "Ya tenés una membresía activa")
- [ ] Con la membresía activa aparece el botón "Cancelar membresía"; al tocarlo pide confirmación y aclara que el acceso se conserva hasta la fecha ya paga
- [ ] Al confirmar la cancelación, la tarjeta pasa a **Cancelada** y el vet **conserva** el acceso hasta la fecha de vencimiento
- [ ] Tocar "Cancelar membresía" dos veces (o cancelar también desde MercadoPago) no rompe: la segunda vez avisa que ya está cancelada
- [ ] Cancelando desde la cuenta de MercadoPago en vez de la app, el estado igual se sincroniza por webhook
- [ ] Pasada la fecha de vencimiento, un vet con más de 5 caballos propios vuelve a ver el modal bloqueante
- [ ] Desde el modal bloqueante, "Retomar membresía" abre el checkout igual que desde el panel
- [ ] Los caballos dados de baja **no** se reactivan solos al pagar: siguen en la sección "Dados de baja" hasta que el vet los elija
- [ ] Un `POST` sin firma a la URL del webhook responde **401** (`curl -i -X POST <url-del-webhook>`)
- [ ] El simulador de notificaciones de MercadoPago responde **200**

---

## 6. Alertas

- [ ] Página de alertas carga sin errores
- [ ] Se puede crear una nueva alerta para un caballo
- [ ] Alertas aparecen en el dashboard (pendiente: ticket "Alertas en dashboard")

---

## 7. Administración (solo admin)

### Usuarios
- [ ] Lista de usuarios del establecimiento carga correctamente
- [ ] Se puede activar / desactivar un usuario

### Invitar usuario
- [ ] Formulario de invitación funciona
- [ ] Usuario invitado recibe el email correctamente

### Accesos veterinario
- [ ] Se pueden asignar accesos masivos (por marca) a un veterinario
- [ ] Se pueden asignar accesos individuales (por caballo) a un veterinario
- [ ] Fix nombre del caballo en esta sección (bug conocido: ticket pendiente)

### Permisos Centro de Cría
- [ ] Se puede activar / desactivar el acceso al centro para un usuario

---

## 8. Configuración

- [ ] Página de configuración carga sin errores
- [ ] Se pueden gestionar los campos (potreros)
- [ ] Crear un nuevo campo funciona
- [ ] Editar / eliminar campo funciona

---

## 9. SuperAdmin

- [ ] Panel superadmin carga sin errores
- [ ] Lista de empresas (sociedades) se muestra correctamente
- [ ] Se puede activar / desactivar una sociedad
- [ ] Lista de usuarios globales funciona
- [ ] Tab Veterinarios: muestra cantidad de caballos propios y estado de suscripción de cada vet
- [ ] Tab Veterinarios: activar/desactivar suscripción funciona y se refleja en el límite del vet

---

## 10. Navegación y layout

- [ ] Sidebar muestra solo las secciones permitidas para cada rol
- [ ] BottomNav en mobile muestra los ítems correctos
- [ ] Drawer mobile abre y cierra correctamente
- [ ] Rutas protegidas redirigen al login si no hay sesión
- [ ] Página 404 aparece en rutas inexistentes
- [ ] La app es usable en mobile (responsive)

---

## 11. Casos límite

- [ ] Sin conexión a Supabase: aparece mensaje de error, no pantalla en blanco
- [ ] Usuario sin sociedad activa: no rompe la app
- [ ] Caballo sin foto: muestra placeholder correctamente
- [ ] Caballo sin padre/madre: árbol genealógico no rompe
- [ ] Historial vacío: muestra estado vacío, no error

---

## Checklist previo a la demo

Correr todo lo anterior con estos usuarios como mínimo:
1. **admin.demo1@haras.com** — flujo completo de admin
2. **vet.demo1@haras.com** — flujo completo de veterinario
3. **jugador.demo1@haras.com** — verificar que solo ve su marca
4. **superadmin@haras.com** — panel superadmin

Verificar además:
- [ ] La app carga en menos de 3 segundos
- [ ] No hay errores en la consola del navegador
- [ ] El video de fondo del login funciona
- [ ] Los datos de demo son coherentes y presentables
- [ ] Vercel tiene el deploy más reciente de `main`
