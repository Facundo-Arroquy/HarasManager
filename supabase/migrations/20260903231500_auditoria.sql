-- Auditoría: quién cambió qué, cuándo, y cómo estaba antes.
--
-- Hasta ahora un cambio sensible no dejaba más rastro que el `updated_at` de la
-- fila: si mañana aparece un caballo dado de baja, un vet con acceso a algo que
-- no le corresponde o un precio de membresía distinto al acordado, no hay forma
-- de saber quién lo hizo ni cuál era el valor anterior. Esta migración crea ese
-- rastro.
--
-- Decisiones:
--
-- * Una sola tabla genérica y no una tabla espejo por cada entidad: las filas
--   viajan como JSONB, así agregar una tabla a la auditoría es una línea de
--   CREATE TRIGGER y no una migración con columnas nuevas.
--
-- * Se auditan solo las tablas sensibles (plata, permisos, propiedad, bajas), no
--   toda la base. Auditar todo hace que el volumen tape justo lo que se busca, y
--   el historial clínico ya es su propio registro.
--
-- * La tabla es append-only: no hay policy de UPDATE ni de DELETE, y el rol
--   `authenticated` tiene esos permisos revocados. Una auditoría que el propio
--   usuario auditado puede editar no sirve de nada.
--
-- * `usuario_id` no tiene FK a `usuario`: el rastro de lo que hizo alguien tiene
--   que sobrevivir a que se borre ese alguien, que es justo el caso en el que
--   más falta hace.

-- ─────────────────────────────────────────────────────────────────────────────
-- Tabla
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE auditoria (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla         TEXT        NOT NULL,
  -- PK del registro tocado, en texto. Si la tabla tiene PK compuesta, se guardan
  -- los valores unidos por ':' en el orden de la PK.
  registro_id   TEXT,
  operacion     TEXT        NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
  -- NULL = no lo hizo un usuario logueado: service_role, una Edge Function, el
  -- SQL Editor o una migración. Que sea NULL ya es información.
  usuario_id    UUID,
  -- Se copia de la fila cuando la tiene, para poder filtrar por empresa sin
  -- salir a buscarla a la tabla original (que para un DELETE ya no existe).
  sociedad_id   UUID,
  -- Solo en UPDATE: qué columnas cambiaron. Evita tener que diffear los JSONB
  -- a mano para responder "¿alguien tocó el precio?".
  campos        TEXT[],
  datos_antes   JSONB,
  datos_despues JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE auditoria IS
  'Registro append-only de cambios en las tablas sensibles. Lo escribe el trigger fn_auditar(); nadie lo edita.';

CREATE INDEX auditoria_tabla_fecha_idx ON auditoria (tabla, created_at DESC);
CREATE INDEX auditoria_registro_idx    ON auditoria (tabla, registro_id);
CREATE INDEX auditoria_usuario_idx     ON auditoria (usuario_id, created_at DESC);
CREATE INDEX auditoria_sociedad_idx    ON auditoria (sociedad_id, created_at DESC)
  WHERE sociedad_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: se lee, no se escribe
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;

-- El superadmin ve todo; el admin de una empresa ve lo que pasó en su empresa.
-- Las filas sin `sociedad_id` (plan de suscripción, usuarios, pagos) son solo
-- del superadmin: son transversales a todos los establecimientos.
CREATE POLICY auditoria_select ON auditoria
  FOR SELECT TO authenticated
  USING (is_superadmin() OR (sociedad_id IS NOT NULL AND es_admin(sociedad_id)));

-- Sin policies de INSERT/UPDATE/DELETE: por PostgREST no entra ni sale nada.
-- El trigger escribe igual porque es SECURITY DEFINER.
REVOKE INSERT, UPDATE, DELETE ON auditoria FROM authenticated, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- El trigger
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_auditar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_antes    JSONB;
  v_despues  JSONB;
  v_fila     JSONB;
  v_campos   TEXT[];
  v_registro TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_despues := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_antes := to_jsonb(OLD);
  ELSE
    v_antes   := to_jsonb(OLD);
    v_despues := to_jsonb(NEW);

    SELECT array_agg(o.key ORDER BY o.key)
      INTO v_campos
      FROM jsonb_each(v_antes) AS o
     WHERE o.value IS DISTINCT FROM v_despues -> o.key;

    -- Un UPDATE que no cambió nada, o que solo movió `updated_at`, no es un
    -- hecho que haya que poder auditar: sería ruido tapando lo que importa.
    IF v_campos IS NULL OR v_campos = ARRAY['updated_at'] THEN
      RETURN NULL;
    END IF;
  END IF;

  v_fila := COALESCE(v_despues, v_antes);

  -- La PK sale del catálogo y no de un `->> 'id'` hardcodeado: hay tablas de
  -- cruce (usuario_modulo, sociedad_modulo) que no tienen columna `id`.
  SELECT string_agg(v_fila ->> att.attname, ':' ORDER BY att.attnum)
    INTO v_registro
    FROM pg_index i
    JOIN pg_attribute att
      ON att.attrelid = i.indrelid
     AND att.attnum   = ANY (i.indkey)
   WHERE i.indrelid = TG_RELID
     AND i.indisprimary;

  INSERT INTO auditoria (
    tabla, registro_id, operacion, usuario_id, sociedad_id,
    campos, datos_antes, datos_despues
  )
  VALUES (
    TG_TABLE_NAME,
    v_registro,
    TG_OP,
    auth.uid(),
    NULLIF(v_fila ->> 'sociedad_id', '')::UUID,
    v_campos,
    v_antes,
    v_despues
  );

  RETURN NULL;  -- AFTER trigger: el valor de retorno se ignora
END;
$$;

COMMENT ON FUNCTION fn_auditar() IS
  'Trigger genérico de auditoría. Se engancha AFTER INSERT/UPDATE/DELETE en las tablas sensibles.';

-- Es SECURITY DEFINER y, sin esto, queda expuesta como `/rest/v1/rpc/fn_auditar`.
-- Llamarla así falla igual (Postgres no deja invocar una función de trigger a
-- mano), pero no tiene por qué estar publicada: el linter de Supabase lo marca.
REVOKE EXECUTE ON FUNCTION fn_auditar() FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Qué se audita
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Plata ───────────────────────────────────────────────────────────────────
-- Precio de la membresía, estado de cada suscripción y los pagos que registra
-- el webhook de MercadoPago.
CREATE TRIGGER auditar AFTER INSERT OR UPDATE OR DELETE ON plan_suscripcion_vet
  FOR EACH ROW EXECUTE FUNCTION fn_auditar();

CREATE TRIGGER auditar AFTER INSERT OR UPDATE OR DELETE ON suscripcion_veterinario
  FOR EACH ROW EXECUTE FUNCTION fn_auditar();

CREATE TRIGGER auditar AFTER INSERT OR UPDATE OR DELETE ON pago_veterinario
  FOR EACH ROW EXECUTE FUNCTION fn_auditar();

CREATE TRIGGER auditar AFTER INSERT OR UPDATE OR DELETE ON venta_caballo
  FOR EACH ROW EXECUTE FUNCTION fn_auditar();

-- ── Quién puede ver qué ─────────────────────────────────────────────────────
-- Accesos del veterinario a caballos, membresías a empresas y habilitación de
-- módulos: es lo que hay que poder reconstruir ante "este vet vio algo que no
-- tendría que haber visto".
CREATE TRIGGER auditar AFTER INSERT OR UPDATE OR DELETE ON acceso_vet
  FOR EACH ROW EXECUTE FUNCTION fn_auditar();

CREATE TRIGGER auditar AFTER INSERT OR UPDATE OR DELETE ON membresia
  FOR EACH ROW EXECUTE FUNCTION fn_auditar();

CREATE TRIGGER auditar AFTER INSERT OR UPDATE OR DELETE ON membresia_modulo
  FOR EACH ROW EXECUTE FUNCTION fn_auditar();

CREATE TRIGGER auditar AFTER INSERT OR UPDATE OR DELETE ON sociedad_modulo
  FOR EACH ROW EXECUTE FUNCTION fn_auditar();

CREATE TRIGGER auditar AFTER INSERT OR UPDATE OR DELETE ON usuario_modulo
  FOR EACH ROW EXECUTE FUNCTION fn_auditar();

-- El alta y la baja de un usuario siempre; de los UPDATE solo los dos que
-- cambian qué puede hacer, no cada vez que se corrige un teléfono.
CREATE TRIGGER auditar
  AFTER INSERT OR DELETE OR UPDATE OF rol, activo ON usuario
  FOR EACH ROW EXECUTE FUNCTION fn_auditar();

-- ── De quién es cada animal ─────────────────────────────────────────────────
CREATE TRIGGER auditar AFTER INSERT OR UPDATE OR DELETE ON propiedad
  FOR EACH ROW EXECUTE FUNCTION fn_auditar();

CREATE TRIGGER auditar AFTER INSERT OR UPDATE OR DELETE ON propietario
  FOR EACH ROW EXECUTE FUNCTION fn_auditar();

-- Del caballo se audita la baja y el cambio de empresa, no cada edición de
-- ficha: son 125 animales que se editan en tandas y el ruido taparía el resto.
CREATE TRIGGER auditar
  AFTER DELETE OR UPDATE OF activo, sociedad_id ON caballo
  FOR EACH ROW EXECUTE FUNCTION fn_auditar();

-- ── Lo que no se debería poder tocar ────────────────────────────────────────
-- El historial clínico es inmutable por regla de negocio: solo el vet que lo
-- creó lo edita. No se auditan los INSERT (son el uso normal, y son muchos),
-- pero sí toda edición y todo borrado.
CREATE TRIGGER auditar AFTER UPDATE OR DELETE ON historial_clinico
  FOR EACH ROW EXECUTE FUNCTION fn_auditar();
