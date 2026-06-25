# Tasks luego de reunión — 20 de junio (Gero + Facu + Tomi)

> Listado priorizado de cambios surgidos de la reunión.
> Las "dudas" son cosas que no quedaron 100% claras y hay que definir antes de implementar.

---

## 🔴 Alta prioridad

### 1. Módulo de Sanidad / Vacunas (NUEVO módulo — el más pedido en la reunión)

**Qué es:** Hoy todo va a `historial_clinico`. La reunión dejó claro que hay que tener un módulo específico de **sanidad** separado del historial clínico general.

**Incluye:**
- Plan sanitario por tipo de animal (yegua preñada, de recría)
- Registro de vacunas por caballo con dosis y fechas
- Vista de "próximas aplicaciones" ordenada por fecha (las más próximas primero)
- Muchas vacunas mezcladas para distintos caballos → necesita vista consolidada de todos los animales
- Registro de trabajo para **más de un caballo** a la vez (aplicar vacuna a N caballos en una sola carga)
- Trabajos planificados ("desde antes") vs. trabajos que surgen ("extras")

**Dudas:**
- ¿El "plan sanitario" son templates predefinidos que se asignan a un caballo, o son registros individuales? Si son templates habría que crear una tabla `plan_sanitario` con items + tabla de aplicación por caballo.
- ¿"Registro de trabajo por día por veterinario" es una nueva vista/reporte o una nueva tabla? ¿O es el historial_clinico filtrado por vet + fecha?
- ¿Los "trabajos" de sanidad van en `historial_clinico` como un tipo de consulta nuevo, o en una tabla separada?

---

### 2. Ocultar Centro de Cría si la sociedad no lo tiene activo

**Qué es:** Si la sociedad **no** tiene `acceso_centro_cria = true`, ocultar completamente la sección de Centro de Cría del sidebar y de cualquier vista (admin y vet).

**Dónde aplica:** Sidebar, navegación, y cualquier referencia al módulo de embriones.

**Ya existe:** `sociedad.acceso_centro_cria BOOLEAN` en el schema. Solo hay que conectar la lógica en el frontend.

---

### 3. Mejora del selector de caballo en nueva consulta/registro

**Qué es:** Cuando el vet carga un nuevo registro, el selector de caballo debe permitir filtrar por:
`Empresa (sociedad) → Nombre del campo/camada → Caballo`

También: algunos caballos jóvenes **solo tienen RP (número)** como identificador (no tienen nombre). El selector debe mostrar el RP si no hay nombre.

**Dudas:**
- ¿"RP" es el campo `numero_registro` que ya existe en la tabla `caballo`, o es un campo nuevo? En la reunión se mencionó como el identificador principal en la primer etapa de cría.
- ¿"Camada" en este contexto es el campo `campo` de la DB, o es un grupo de animales nacidos en la misma temporada?

---

### 4. Modificar filtros de caballos en vista admin

**Qué es:** Mejorar los filtros en el panel de caballos del admin.

**Ya estaba en TASKS.md** como tarea pendiente. La reunión lo reconfirmó.

---

### 5. Campos del útero más detallados en revisión reproductiva

**Qué es:** El registro clínico del centro de cría (`cria_registro_clinico`) necesita capturar más info del útero:
- **C/T** (con tono / sin tono)
- **Niveles de edema:** ED 1, ED 2, ED 3
- **Nivel de líquido:** + / ++ / +++

Hoy el campo `utero TEXT[]` existe pero habría que definir los valores posibles y asegurarse de que el formulario los capture.

**Nota de la reunión:** "Los tratamientos/acciones del registro reproductivo sean configurables" → los valores de edema, líquido, etc. deberían poder ajustarse.

---

### 6. Transferencia de embriones vitrificados (congelados) a receptoras

**Qué es:** Hoy los embriones con estado `'congelado'` en la tabla `embrion` no se pueden transferir desde la UI. Hay que habilitar:
- Vista de embriones vitrificados
- Posibilidad de transferirlos a una receptora (flujo igual al de embrión fresco)

**Ya existe en DB:** `embrion.estado IN ('disponible','transferido','descartado','congelado')` y `cria_transferencia.clasificacion TEXT` ('Fresco' | 'Congelado').

---

### 7. Acciones y tratamientos del registro reproductivo configurables

**Qué es:** Hoy las acciones en el centro (Strelin, Oxi, PG, etc.) son texto libre o hardcodeado. Deben ser configurables por sociedad.

**Detalle de la reunión:**
- A la receptora NO se insemina ni se hace flushing
- Oxi = contraer el útero
- PG = reinicia el ciclo
- 1PG para levantar edema
- Los tratamientos deben poder configurarse

**Duda:** ¿"Configurables" significa que el admin puede agregar/editar los valores del catálogo, o que el vet puede escribir texto libre? Hay que definir si va en `cria_parametro` o en un catálogo nuevo (`cat_accion_reproductiva`).

---

## 🟡 Media prioridad

### 8. "Aborta" en ecografía debe disparar estado de la receptora

**Qué es:** Cuando en una ecografía el resultado es "abortada", la yegua receptora debe:
- Cambiar `estado_reproductivo` → `'vacia'`
- Aparecer en una lista de "yeguas vacías" o "yeguas que abortaron"
- Reiniciar el flujo para poder volver a recibir un embrión

**Ya existe:** La columna `estado_reproductivo` en `caballo` y `cria_ecografia.resultado IN ('prenada','abortada','pendiente')`. Hay que conectar la lógica.

---

### 9. Ecos post-transferencia configurables (número y ventanas de tiempo)

**Qué es:** La reunión definió:
- **Eco 1:** X días desde transferencia (configurable)
- **Eco 2:** X días desde Eco 1 (configurable, y configurable si se hace o no)
- **Eco 3:** Sexado (H / M / vacía / aborta), X días (configurable)
- Posibilidad de agregar 1 o 2 ecos adicionales

**Hoy:** `cria_ecografia.numero SMALLINT CHECK (numero IN (1,2,3))` — limita a 3 ecos. Habría que ampliar o cambiar el constraint si se habilitan ecos adicionales.

**Duda:** ¿Los ecos adicionales son raros o es algo frecuente? Si es frecuente conviene sacar el constraint `IN (1,2,3)` y permitir `numero >= 1`.

---

### 10. Alertas configurables por acción reproductiva

**Qué es:** Cada acción del centro (Strelin, inseminación, flushing, OV, etc.) debe poder disparar una alerta con X horas/días configurables.

**Ya existe parcialmente:** `cria_parametro` tiene claves como `dias_strelling_alerta`, `horas_oxy_alerta`, etc. Hay que revisar si están todas las acciones cubiertas y si la UI permite configurarlas.

---

### 11. Revisión configurable por días de la semana (donante vs receptora)

**Qué es:** Cada animal en el centro puede tener definido en qué días de la semana se hace la revisión, y esto es diferente para donantes y receptoras.

**Duda:** ¿Cómo se almacena? ¿Nueva columna en `caballo` (ej. `dias_revision INTEGER[]`)? ¿O en una tabla aparte? ¿Lo configura el vet o el admin?

---

### 12. Vista "próximas aplicaciones" en Dashboard

**Qué es:** Una vista/widget en el dashboard del vet y del admin que muestre todos los próximos trabajos sanitarios (vacunas, recordatorios) ordenados por fecha, para todos los caballos a cargo.

**Relacionado con:** Task 1 (Módulo de Sanidad) — no se puede hacer sin definir antes la estructura de datos de sanidad.

---

### 13. Recordatorio: estado "Muerta / Baja"

**Qué es:** Cuando un caballo muere o es dado de baja, los recordatorios activos de ese caballo deben marcarse como cancelados automáticamente (o con un motivo especial "muerta/baja").

**Duda:** ¿"Muerta/baja" es un nuevo `cancel_motivo` en `cria_recordatorio`, o también hay que cambiar el estado del caballo (`caballo.activo = false`)?

---

### 14. Ver días de preñada desde fecha de transferencia

**Qué es:** En la ficha de una yegua receptora preñada, mostrar cuántos días lleva preñada y la fecha probable de parto (transferencia + 335,5 días — ya calculada en DB como `fecha_probable_parto GENERATED ALWAYS`).

**Ya existe en DB:** `cria_transferencia.fecha_probable_parto DATE GENERATED ALWAYS AS ((fecha + INTERVAL '335 days 12 hours')::date) STORED`

Solo falta mostrarlo en la UI.

---

### 15. Registro de trabajo por día por veterinario (vista / reporte)

**Qué es:** El vet debería poder ver un resumen de todo lo que hizo en un día determinado (o rango de fechas). Tipo "parte diario" del vet.

**Duda:** ¿Es una vista nueva dentro de la app, o es una exportación/reporte? ¿Incluye solo el centro de cría o también historial clínico y sanidad?

---

## 🟢 Baja prioridad

### 16. Tarjetas visuales por tipo de trabajo en el panel del vet

**Qué es:** El panel del vet debe mostrar los próximos trabajos en tarjetas visuales agrupadas por tipo (sanidad, reproductivo, etc.) en lugar de una lista plana.

La reunión mencionó una imagen (C8DF0FC7...) que no pude ver pero parece ser un mockup de este panel.

---

### 17. Nombre del establecimiento/empresa visible en el listado del vet

**Qué es:** En el listado de caballos del vet, mostrar a qué empresa/campo pertenece cada uno para identificarlos rápidamente.

---

## ❓ Dudas / Cosas a definir antes de implementar

| # | Duda | Quién define |
|---|------|-------------|
| A | ¿"RP" es `numero_registro` existente o campo nuevo? | Gero / Tomi |
| B | ¿"Camada" = `campo` en DB, o es una agrupación por temporada/fecha de nacimiento? | Gero |
| C | ¿Plan sanitario = template reutilizable o registros individuales por caballo? | Gero / Tomi |
| D | ¿Los "trabajos" de sanidad van en `historial_clinico` o tabla separada? | Facu decide según modelo |
| E | ¿"Configurables" en acciones reproductivas = catálogo editable o texto libre? | Gero |
| F | ¿Revisión por días de semana: lo configura el vet o el admin? ¿Es por animal o global? | Gero |
| G | ¿Ecos adicionales (más allá de 3) son frecuentes? ¿Hay que romper el constraint? | Gero |
| H | ¿"Registro de trabajo por día" es vista en app o exportación PDF/Excel? | Gero / Tomi |
| I | ¿"Trabajo para más de un caballo" es aplicar el mismo registro a N caballos en una carga, o es otra cosa? | Gero |
| J | ¿Qué imagen/mockup es el C8DF0FC7...PNG? No se pudo visualizar en esta sesión. | Facu revisar |

---

## 📋 Cosas que YA estaban en TASKS.md y la reunión reconfirmó

- Tag de yeguas preñadas + próximos partos (ya en TASKS.md como pendiente)
- Filtro por camada en panel de caballos (ya en TASKS.md)
- Orden de listas del programa semanal por empresa y campo (ya en TASKS.md)
- Sacar "Transferencias" de la vista de Caballos (ya en CLAUDE.md como regla)

---

*Generado el 2026-06-25 a partir de los apuntes de la reunión del 20-jun.*
