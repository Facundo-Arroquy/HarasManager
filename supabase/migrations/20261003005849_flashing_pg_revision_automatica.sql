-- PG automatica en el protocolo de flushing y su Revision PG.
-- La base es la fuente de verdad: cualquier alta/edicion (no solo la UI)
-- respeta la configuracion del veterinario y mantiene un unico recordatorio.

ALTER TABLE public.cria_plazo_vet
  ADD COLUMN IF NOT EXISTS donante_flushing_aplica_pg boolean NOT NULL DEFAULT true;

ALTER TABLE public.cria_recordatorio
  ADD COLUMN IF NOT EXISTS flushing_id uuid REFERENCES public.cria_flushing(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cria_recordatorio_flushing_tipo
  ON public.cria_recordatorio(flushing_id, tipo)
  WHERE flushing_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cria_recordatorio_flushing_estado
  ON public.cria_recordatorio(flushing_id, estado)
  WHERE flushing_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public._cria_flushing_aplicar_config_pg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aplica boolean;
BEGIN
  SELECT donante_flushing_aplica_pg INTO v_aplica
  FROM cria_plazo_vet
  WHERE veterinario_id = NEW.veterinario_id;

  -- Un vet sin fila de configuracion usa el default del protocolo: aplica PG.
  NEW.pg_given := NEW.pg_given OR COALESCE(v_aplica, true);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._cria_flushing_sincronizar_revision_pg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dias smallint;
BEGIN
  IF NEW.pg_given THEN
    SELECT donante_pg_a_revision_pg INTO v_dias
    FROM cria_plazo_vet
    WHERE veterinario_id = NEW.veterinario_id;
    v_dias := COALESCE(v_dias, 3);

    INSERT INTO cria_recordatorio(
      caballo_id, sociedad_id, tipo, fecha_vto, estado, veterinario_id,
      notas, auto_generado, origen_registro_id, flushing_id
    ) VALUES (
      NEW.caballo_id, NEW.sociedad_id, 'Revisión PG', NEW.fecha + v_dias,
      'pendiente', NEW.veterinario_id,
      format('PG aplicada en flushing. Revisar a los %s días.', v_dias),
      true, NULL, NEW.id
    )
    ON CONFLICT (flushing_id, tipo) WHERE flushing_id IS NOT NULL
    DO UPDATE SET
      caballo_id = EXCLUDED.caballo_id,
      sociedad_id = EXCLUDED.sociedad_id,
      fecha_vto = EXCLUDED.fecha_vto,
      estado = 'pendiente',
      veterinario_id = EXCLUDED.veterinario_id,
      notas = EXCLUDED.notas,
      cancel_motivo = NULL,
      updated_at = now();
  ELSE
    UPDATE cria_recordatorio
    SET estado = 'cancelado',
        cancel_motivo = 'Se corrigió el flushing: PG no aplicada',
        updated_at = now()
    WHERE flushing_id = NEW.id
      AND tipo = 'Revisión PG'
      AND estado IN ('pendiente', 'vencido');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._cria_reprogramar_revisiones_pg_por_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.donante_pg_a_revision_pg IS DISTINCT FROM OLD.donante_pg_a_revision_pg THEN
    UPDATE cria_recordatorio r
    SET fecha_vto = f.fecha + NEW.donante_pg_a_revision_pg,
        notas = format('PG aplicada en flushing. Revisar a los %s días.', NEW.donante_pg_a_revision_pg),
        updated_at = now()
    FROM cria_flushing f
    WHERE r.flushing_id = f.id
      AND f.veterinario_id = NEW.veterinario_id
      AND f.pg_given
      AND r.tipo = 'Revisión PG'
      AND r.estado IN ('pendiente', 'vencido');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cria_flushing_aplicar_config_pg ON public.cria_flushing;
CREATE TRIGGER trg_cria_flushing_aplicar_config_pg
  BEFORE INSERT OR UPDATE OF pg_given, veterinario_id ON public.cria_flushing
  FOR EACH ROW EXECUTE FUNCTION public._cria_flushing_aplicar_config_pg();

DROP TRIGGER IF EXISTS trg_cria_flushing_sincronizar_revision_pg ON public.cria_flushing;
CREATE TRIGGER trg_cria_flushing_sincronizar_revision_pg
  AFTER INSERT OR UPDATE OF pg_given, fecha, veterinario_id, caballo_id, sociedad_id
  ON public.cria_flushing
  FOR EACH ROW EXECUTE FUNCTION public._cria_flushing_sincronizar_revision_pg();

DROP TRIGGER IF EXISTS trg_cria_reprogramar_revisiones_pg_por_config ON public.cria_plazo_vet;
CREATE TRIGGER trg_cria_reprogramar_revisiones_pg_por_config
  AFTER UPDATE OF donante_pg_a_revision_pg ON public.cria_plazo_vet
  FOR EACH ROW EXECUTE FUNCTION public._cria_reprogramar_revisiones_pg_por_config();

REVOKE ALL ON FUNCTION public._cria_flushing_aplicar_config_pg() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._cria_flushing_sincronizar_revision_pg() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._cria_reprogramar_revisiones_pg_por_config() FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.cria_plazo_vet.donante_flushing_aplica_pg IS
  'Si está activo, todo flushing registra PG automáticamente y agenda Revisión PG.';
COMMENT ON COLUMN public.cria_recordatorio.flushing_id IS
  'Flushing que originó el recordatorio automático; evita duplicar Revisión PG.';
