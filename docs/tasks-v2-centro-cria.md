# Tasks V2 — Centro de Cría

Pendientes surgidos de las respuestas a las dudas de la reunión del 20-jun
(ver `Tasks luego de reunion-20-jun.md`).

Van a la columna **V2** del kanban. Cada task está verificada contra el schema
vivo de producción al 23/07/2026.

---

## 1. Ampliar niveles de edema: agregar ED 3/2

El registro clínico del centro de cría necesita `ED 3/2` como nivel de edema
intermedio, además de ED 1, ED 2 y ED 3.

El campo es `cria_registro_clinico.utero TEXT[]` — ya existe y **no tiene CHECK
constraint**, así que no requiere migración. Es solo definir la lista de valores
posibles en el frontend y que el formulario los ofrezca.

Valores a soportar en `utero`:

- C/T (con tono / sin tono)
- ED 1, ED 2, **ED 3/2**, ED 3
- Líquido: `+` / `++` / `+++`

**Archivo:** `frontend/src/components/centro-cria/RegistroCriaModal.tsx`

---

## 2. Renombrar "congelado" a "vitrificado" en la base

La UI ya dice "Vitrificado" en todos lados (se hizo en el PR #37), pero el valor
interno sigue siendo `congelado`. Queda inconsistente entre lo que ve el usuario
y lo que hay en la DB.

Estado actual en prod:

```
embrion_estado_check             → CHECK (estado IN ('disponible','transferido','descartado','congelado'))
cria_transferencia.clasificacion → TEXT libre, el front escribe 'Fresco' | 'Congelado'
```

Qué hacer:

1. Migración: `UPDATE embrion SET estado = 'vitrificado' WHERE estado = 'congelado'`,
   después reemplazar el CHECK constraint.
2. Lo mismo para `cria_transferencia.clasificacion` (`'Congelado'` → `'Vitrificado'`).
3. Actualizar el tipo `EstadoEmbrion` en `frontend/src/types/crianza.ts` y los
   mapeos de `EmbrionesPage.tsx` y `TransferenciaModal.tsx`, donde hoy se traduce
   `congelado → 'Vitrificado'` a mano.
4. Actualizar `docs/SKILL.md`.

**Ojo:** el UPDATE va **antes** de cambiar el constraint, y las dos cosas en la
misma migración.

---

## 3. Yegua abortada: debe figurar en vacías y en abortadas

Cuando una ecografía da `abortada`, hoy no pasa nada automático. La yegua debe:

1. Pasar a `caballo.estado_reproductivo = 'vacia'` para poder volver a recibir un
   embrión.
2. **Seguir siendo identificable como abortada.** Es el punto clave: si una yegua
   abortó, hay que tenerlo en cuenta para no transferirle un buen embrión — hay
   probabilidad de que vuelva a abortar. Tiene que aparecer en ambas listas, no
   solo en vacías.

Ya existe en DB:

- `caballo.estado_reproductivo` acepta `'vacia'` (y también `'prenada'`,
  `'transferida'`, `'eco1'`..`'eco3'`)
- `cria_ecografia.resultado CHECK (resultado IN ('prenada','abortada','pendiente'))`

El problema: `estado_reproductivo` es un solo valor, así que si lo ponés en
`'vacia'` perdés el dato del aborto. Hay que decidir cómo persistir el
antecedente — lo más simple es derivarlo consultando el historial de
`cria_ecografia` (¿tiene alguna con `resultado = 'abortada'`?), sin columna nueva.

Además: mostrar un aviso en el modal de transferencia cuando la receptora
seleccionada tiene antecedente de aborto.

---

## 4. Sacar el límite de 3 ecografías

Hoy no se pueden cargar más de 3 ecos por transferencia. Confirmado en prod:

```
cria_ecografia_numero_check → CHECK (numero IN (1, 2, 3))
```

Migración: reemplazar por `CHECK (numero >= 1)`.

Revisar también el frontend, que probablemente asume 3 ecos fijas (los estados
`eco1`/`eco2`/`eco3` de `estado_reproductivo` están hardcodeados con ese
supuesto, así que hay que ver cómo se etiquetan las ecos a partir de la cuarta).
