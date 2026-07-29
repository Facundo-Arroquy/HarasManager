# Respuestas de Gero (definiciones de diseño)

> Respuestas a las 10 preguntas de `Preguntas para Gero.md`.
> Estas son las decisiones que destraban el módulo de sanidad y los
> configurables del centro de cría.

---

### 1. RP del caballo
**El RP es fijo.** Es un identificador estable del animal, no cambia con el
tiempo. → Se usa como identificador cuando el caballo todavía no tiene nombre
(ya implementado con `numero_registro`).

### 2. Camada
**Camada = año de parición/nacimiento, con año cortado de julio a junio.**
Un potrillo nacido en julio 2024 pertenece a la camada 2024-2025.
→ Coincide con la lógica ya existente en el front (`getCamada`, corte en julio).
Confirmado, no hay que cambiar nada.

### 3. Plan sanitario
- En **configuración** hay algunos planes/trabajos **básicos pre-cargados**.
- Un plan/trabajo es una **lista de caballos que arma el usuario**, agregando o
  sacando caballos para cada trabajo a realizar.
→ Modelo: catálogo de trabajos (con algunos pre-cargados) + armado de listas de
  caballos por trabajo. Se conecta directo con la respuesta 5.

### 4. Dónde se anotan las vacunas / trabajos de sanidad
**Van en el historial clínico** del caballo (no en una tabla separada).
→ Sanidad = un tipo de registro dentro de `historial_clinico`.

### 5. Un trabajo para varios caballos  ⭐ (flujo central)
Ejemplo: desparasitar X caballos.
- Se **arma un listado** de caballos para el día X. Se puede:
  - cargar un listado,
  - seleccionar uno a uno con checkbox, o
  - seleccionar un **campo completo**.
- El día X se marca **"realizado" para todos** de una sola vez.
- Al marcar realizado, **se carga el trabajo en el historial de cada caballo**.
- Se puede **excluir** caballos del listado con checkbox al momento de completar.
→ Es un "trabajo programado multi-caballo" con carga en masa al historial.

### 6. Acciones del centro configurables
**Opción B:** el usuario puede **agregar y sacar** opciones de la lista
(Strelin, Oxi, PG, etc.). → Catálogo editable, no texto libre.

### 7. Días de revisión (donante vs receptora)
**Configurable por el veterinario.** Cada quién define los días de la semana en
que revisa. → La config vive del lado del vet.

### 8. Cantidad de ecografías
**Normalmente 3, pero puede pasar (raro) que se necesiten más.**
→ Hay que permitir más de 3 ecos, dejando 3 como lo habitual.
⚠️ Impacto en lo ya hecho: el modal de ecografías (Task 8) hoy limita a Eco
   1/2/3 por el CHECK `numero IN (1,2,3)` en DB. Hay que **relajar el
   constraint** (migración) y permitir agregar ecos extra en la UI.

### 9. Parte diario del veterinario
**Se ve más adelante.** Queda pausado.

### 10. Yegua muerta / baja
Al dar de baja / marcar muerta una yegua:
- **Todo lo pendiente se cancela solo, en cascada** (recordatorios, trabajos).
- **Se conserva el historial** de la yegua (no se borra).
→ `caballo.activo = false` (o estado equivalente) + cancelación automática de
  pendientes, preservando registros históricos.

---

*Registrado a partir de las respuestas de Gero.*
