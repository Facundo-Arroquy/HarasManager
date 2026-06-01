# TASKS — HarasManager

> Actualizar este archivo cuando se empiece o termine un ticket.
> Antes de arrancar una tarea, verificar que nadie más la tenga asignada.

## Cómo usar

- **Estado:** `pendiente` | `en proceso` | `QA` | `terminado`
- **Prioridad:** `alta` | `media` | `baja`
- **Asignado:** nombre del dev, o `-` si no está asignado aún

---

## 🔴 Alta prioridad

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

### [ ] Fix Centro de embriones en panel reproductivo
- **Estado:** QA
- **Asignado:** -
- **Descripción:** Aparece "Error al cargar datos" desde el lado de admin. Causa probable: problema de permisos RLS o query incorrecta.
- **Avance:** UI admin ahora es read-only (ocultos todos los botones de escritura). El error en `cargar()` ahora muestra qué query falla: `[registros] ...`, `[recordatorios] ...`, etc. Falta confirmar la causa raíz corriendo el app con admin real.

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
- **Estado:** pendiente
- **Asignado:** -
- **Descripción:** Agregar filtro en el panel de caballos para ver por camada. Incluir un selector de rango de fechas (calendario de → hasta) basado en la fecha de nacimiento para acotar los resultados por temporada o período.

### [ ] Tag de yeguas preñadas
- **Estado:** pendiente
- **Asignado:** -
- **Descripción:** Mostrar un tag visual en el listado/ficha de cada yegua que indique si está preñada. El tag debe incluir el padrillo o, en caso de inseminación artificial, el semen utilizado. Definir dónde se carga este dato (historial reproductivo, ficha del caballo, etc.) y cómo se representa en DB.

### [ ] Ayuda y tooltips
- **Estado:** pendiente
- **Asignado:** -
- **Descripción:** Agregar chatbot de ayuda básico predefinido y tooltips en la interfaz.

### [x] Inventarle nombre y logo con color característico
- **Estado:** terminado
- **Asignado:** -
- **Descripción:** Definir nombre del producto, logo e identidad visual con color característico.

### [ ] Mandarle a Gero el Excel base
- **Estado:** en proceso
- **Asignado:** Facundo
- **Descripción:** Preparar y enviar el archivo Excel base a Gero.

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

### [ ] Próximos partos
- **Estado:** pendiente
- **Asignado:** -
- **Descripción:** Agregar categoría "Yegua preñada" y a partir de ahí calcular/mostrar fechas estimadas de parto.

### [ ] Lista de caballos para la temporada
- **Estado:** pendiente
- **Asignado:** -
- **Descripción:** Que los usuarios puedan armar el listado de caballos para la temporada en formato kanban.

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

### [x] Fix Genealogía
- **Prioridad:** alta
- **Descripción:** Corrección de bugs en el árbol genealógico.

### [x] Fix Selección animal en centro de embriones
- **Prioridad:** alta
- **Descripción:** En el centro de embriones no dejaba seleccionar un animal al querer agregar un registro.

---

## 🚫 No se hace

_(vacío por ahora)_
