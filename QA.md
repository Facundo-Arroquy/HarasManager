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
