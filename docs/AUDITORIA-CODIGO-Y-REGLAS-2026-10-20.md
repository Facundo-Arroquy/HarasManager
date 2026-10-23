# Auditoría de código muerto y reglas configurables

Fecha: 2026-10-20  
Base revisada: `origin/main` en `46c120bada542012bd8d55f7b44ba5c129656feb`  
Rama: `audit/codigo-reglas-negocio-2026-10-20`

## Resumen ejecutivo

Sí hay código muerto y restos de modelos abandonados.

- Hay un componente completo sin ninguna ruta ni importación: `pages/admin/InvitarUsuarioTab.tsx`.
- El importador conserva el modelo abandonado de `marca`: consulta una tabla que no existe en el modelo vivo, valida una columna Excel y construye `marca_id`, pero finalmente no inserta ese dato.
- Las tablas `alerta`/`alerta_caballo` y `cria_parametro` están documentadas como no consumidas por la aplicación actual. No deben borrarse solo con esta evidencia porque pueden conservar datos históricos y el esquema remoto tiene drift.
- No existe una prohibición global de trabajar domingos. Para recordatorios que caen sábado o domingo la UI permite mantener la fecha o moverla. Sí existe una regla fija no configurable: las revisiones Strelin de receptoras se programan al próximo lunes, miércoles o viernes.
- La configuración reproductiva está orientada principalmente al veterinario, no a la empresa. Esto es coherente con la definición documentada de que el plazo “viaja con el veterinario”, pero hay reglas globales fijas mezcladas con esa configuración.
- El historial de migraciones local no representa producción. `supabase migration list --linked` muestra muchas versiones solo locales y muchas solo remotas. Por eso ningún objeto SQL debe declararse borrable hasta reconciliar el schema vivo.

## Alcance y verificaciones

Se revisaron rutas, componentes, hooks, services, stores, utilidades, tipos, Edge Functions, migraciones y documentación de arquitectura.

Verificaciones automáticas:

- `npm run build`: pasa.
- `npm run test`: 4 archivos y 38 tests, todos pasan.
- `npm run lint`: 0 errores y 4 warnings de dependencias de hooks.
- Grafo estático de imports desde `src/main.tsx`: un archivo productivo inaccesible confirmado.
- `supabase migration list --linked`: confirma drift severo entre archivos locales e historial remoto.

Advertencias del build/revisión:

- El chunk lazy del importador pesa aproximadamente 948 kB minificado / 262 kB gzip por ExcelJS.
- ESLint marca dependencias faltantes en `RegistroCriaModal`, `EditarTrabajoSanitarioModal` y dos `useMemo` de `CaballosPage`. No son código muerto, pero los dos `useMemo` pueden devolver resultados obsoletos al cambiar filtros basados en `Set`.

## Código muerto confirmado

### 1. `InvitarUsuarioTab.tsx`

`frontend/src/pages/admin/InvitarUsuarioTab.tsx` no es importado por ningún archivo y no aparece en el árbol de rutas. Contiene un flujo completo alternativo para buscar un usuario existente e insertar una membresía.

Además de estar inaccesible, duplica reglas delicadas:

- IDs numéricos de roles hardcodeados (`1..5`).
- Consulta directa a `membresia`.
- Uso de la RPC `buscar_usuario_por_email`.

Recomendación: eliminar el archivo si el flujo vigente es `UsuariosTab`/alta por administrador; si se desea recuperar la funcionalidad, convertirla en un ticket y reutilizar catálogos/servicios en lugar de reactivar este componente tal como está.

### 2. Restos del modelo abandonado `marca`

Archivos involucrados:

- `frontend/src/services/marcaService.ts`
- `frontend/src/components/domain/ImportarCaballosModal.tsx`
- `frontend/src/utils/importarCaballos.ts`

La arquitectura vigente declara abandonados `marca` y `caballo.marca_id`. Sin embargo, el importador todavía:

1. consulta `.from('marca')`;
2. lee la columna `marca` del Excel;
3. valida el nombre y calcula `marca_id`;
4. coloca `marca_id` en `BulkCaballoPayload`;
5. descarta `marca_id` al construir las filas reales para `caballo`.

La falla de la consulta queda silenciada por `Promise.allSettled`, de modo que la pantalla continúa con una lista vacía. Es código funcionalmente muerto y engañoso, aunque no necesariamente rompe el alta.

Recomendación: retirar `marcaService`, la columna/tipo/validación de marca y cualquier encabezado de plantilla asociado. Verificar antes si clientes conservan planillas antiguas con esa columna; en ese caso se puede ignorar explícitamente con un aviso de migración.

## Código o datos sin consumidor actual, pendiente de validar

### `alerta` y `alerta_caballo`

La documentación afirma que la UI de Alertas fue eliminada y que hoy nada lee ni escribe estas tablas. Las “alertas” del panel veterinario vienen de `get_alertas_vet()`, calculadas desde `historial_clinico.proxima_consulta`, no desde `alerta`.

Clasificación: legado con datos históricos, no borrable todavía.

### `cria_parametro`

Fue diseñada para parámetros globales y por sociedad, pero la documentación indica que nunca se conectó al frontend. El flujo vigente usa `cria_plazo_vet`.

Clasificación: modelo reemplazado/inconcluso. Antes de quitarlo hay que consultar el schema vivo y comprobar dependencias en `pg_depend`, funciones, triggers y datos existentes.

### Migraciones antiguas de marca y otros modelos reemplazados

Las migraciones son historial, no código ejecutable de la aplicación. No deben eliminarse individualmente aun cuando describan modelos abandonados. El problema real es que hoy tampoco reconstruyen fielmente producción.

## Reglas configurables hoy

### Por veterinario

- Acciones/chips disponibles en registros reproductivos (`cat_chip_obs`).
- Plazos Strelin → IN, IN → OXI, OV → Flushing/PG, PG → revisión y Flushing → revisión (`cria_plazo_vet`).
- Plazos de Eco 1/2/3 desde la transferencia.
- Aplicación automática de PG al registrar flushing.
- Reglas propias “acción X genera recordatorio Y en N días” (`cria_regla_recordatorio`).
- Revisión manual de cada registro entre 1 y 60 días.
- Ajuste puntual cuando un recordatorio cae en fin de semana: mantenerlo o desplazarlo según las opciones de UI.

### Por empresa/sociedad

- Módulos habilitados (`centro_cria`, `polo`) y permisos por membresía.
- Ranking de padrillos por donante.
- Catálogos sanitarios propios, campos, usuarios y accesos.
- Planes sanitarios y sus fechas.

No hay hoy una configuración activa por empresa para días laborables, feriados, ventana de alertas o protocolos reproductivos. `cria_parametro` parecía apuntar a esto, pero quedó sin consumidor.

### Globales o comerciales

- Precio y frecuencia de la membresía: base de datos (`plan_suscripcion_vet`), correctamente fuera del frontend.
- Límites gratuito/pago: funciones SQL (5/25 según la documentación vigente).
- Módulos disponibles: catálogo global.
- Términos activos: base de datos.

## Reglas hardcodeadas que merecen decisión de producto

| Regla actual | Dónde | Dueño sugerido | Observación |
|---|---|---|---|
| Próximo lunes/miércoles/viernes para revisión Strelin | `crianzaStore.ts` | Veterinario o empresa | Es la regla de calendario rígida más clara. La UI dice expresamente que no es configurable. |
| Fines de semana = advertir y ofrecer mover | modales de cría/flushing | Empresa, con override del vet | No prohíbe trabajar; asume que sábado/domingo requieren tratamiento especial. No contempla feriados. |
| Ventana de IN previa = 7 días | `crianzaStore.ts` | Veterinario/protocolo | Decide si una OV genera Flushing o Dar PG; impacta negocio. |
| OXI → Revisión = 1 día | `crianzaStore.ts` | Veterinario/protocolo | Es el único plazo reproductivo fijo dentro de una lista mayormente configurable. |
| Revisión manual 1..60 días | frontend + constraint SQL | Global o configurable | El máximo es una decisión de producto, no técnica. |
| Revisión de eco 1..120 días | RPC SQL reciente | Global o veterinario | Rango distinto del anterior; conviene unificar criterio y nombres. |
| Eco 1/2/3 = 30/60/90 por defecto | frontend + DB | Veterinario | Ya es editable, pero los defaults están duplicados en dos capas. |
| Alertas del vet = próximos 30 días | `get_alertas_vet()` | Veterinario o empresa | No existe control visible para cambiar la ventana. |
| Fecha probable de parto = transferencia + 335 días y 12 h | columna generada SQL | Global por especie/protocolo | Debe validarse clínicamente y decidir si admite override. |
| Parentesco prohibido = 2 generaciones | funciones SQL | Empresa o global | Regla genética/de negocio con default fijo. |
| Ranking máximo = 10 padrillos | frontend + SQL | Empresa o global | Duplicado entre capas. |
| Gracia de pago = 3 días | RPC de MercadoPago | Global comercial | Debería vivir como política de plan/configuración, no escondida en SQL. |
| Zona horaria = Buenos Aires | `utils/fecha.ts` | Empresa | Correcta para operación argentina actual, pero bloquea multi-país. |
| Camada: julio-diciembre pertenece al año siguiente | `utils/caballo.ts` | Empresa/país/deporte | Convención de negocio hardcodeada. |
| Categorías, estados reproductivos y transiciones | types/utils + constraints SQL | Global versionado | Son reglas centrales válidas, pero duplicadas; requieren cambio coordinado. |
| TTL de fotos firmadas = 1 hora | dos archivos frontend | Global técnico | No es regla de negocio, pero está duplicado. |
| Notificaciones visibles = 20 | `notificacionService.ts` | Usuario/global | Decisión de UX fija. |

## Riesgos de arquitectura detectados

### La lógica de recordatorios vive en el frontend

`crearRegistro` guarda primero el registro clínico y después crea recordatorios en otra operación. Si falla la segunda, el sistema acepta el registro y muestra un toast para que el usuario cargue recordatorios manualmente. Esto puede dejar protocolos incompletos y contradice la regla documentada de que la lógica de negocio debe vivir en funciones de base.

Recomendación: una RPC transaccional que registre el acto y genere/cierre recordatorios usando la configuración del veterinario. Además evita que un cliente viejo aplique reglas distintas.

### Fuentes de verdad duplicadas

Los defaults y límites aparecen en frontend y SQL: plazos, rangos, estados, ranking, categorías y protocolos. Aunque algunos están duplicados para mostrar previews, pueden divergir.

Recomendación: distinguir formalmente:

- constraints invariantes en DB;
- configuración editable en tablas;
- metadatos leídos por UI;
- constantes puramente visuales.

### Drift de base de datos

La comparación del historial muestra que no se puede reconstruir producción con las migraciones del repo. Esto bloquea una eliminación segura de SQL muerto y aumenta el riesgo de que el código compile contra una forma de schema distinta a la real.

Recomendación prioritaria: ejecutar el ticket H6 ya documentado: dump solo de schema, comparación, baseline y registro de diferencias. Recién después clasificar funciones/tablas/policies como vivas o muertas.

### Cobertura automática baja para el tamaño del producto

Hay 38 tests concentrados en cuatro archivos, principalmente reglas de recordatorios, paginación e importación. Faltan tests de rutas/roles, servicios, contratos de RPC, RLS multi-tenant y flujos transaccionales.

## Prioridad recomendada

1. Reconciliar schema vivo y migraciones (H6). Sin esto no hay limpieza SQL segura.
2. Corregir el modelo fantasma de marca en el importador y decidir compatibilidad con planillas viejas.
3. Eliminar o formalmente recuperar `InvitarUsuarioTab.tsx`.
4. Definir una matriz de configuración: global / empresa / veterinario / usuario, empezando por calendario laboral y protocolos reproductivos.
5. Mover la generación de recordatorios a una operación transaccional del servidor.
6. Centralizar defaults y contratos compartidos.
7. Agregar pruebas de RLS/roles y de los flujos críticos antes de una limpieza más amplia.

## Preguntas que producto debe responder

- ¿Los días laborables pertenecen a la empresa, al veterinario o a ambos con override?
- ¿Sábado y domingo son equivalentes? ¿Hay empresas que trabajan sábado normalmente?
- ¿Cómo se cargan feriados y guardias?
- Si dos veterinarios trabajan para la misma empresa con protocolos distintos, ¿qué configuración manda sobre el recordatorio?
- ¿La ventana de alertas (hoy 30 días) debe ser personal, de empresa o fija?
- ¿La revisión Strelin realmente debe ser solo lunes/miércoles/viernes?
- ¿La ventana de inseminación de 7 días y la revisión OXI a 1 día varían por profesional?
- ¿335 días es un estimado universal o debe poder corregirse por transferencia/preñez?
- ¿El parentesco de 2 generaciones y el ranking de 10 son límites clínicos/comerciales o defaults editables?

