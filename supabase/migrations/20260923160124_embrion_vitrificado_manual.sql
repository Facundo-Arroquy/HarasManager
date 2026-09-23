-- Embrión vitrificado cargado a mano, sin flushing.
--
-- Es stock que ya existía (de antes del sistema, comprado o de otro centro):
-- no sale de un flushing cargado acá. Lo pueden cargar el veterinario con
-- acceso a la donante y el admin de la sociedad dueña de la donante.
--
-- Como el embrión manual no tiene flushing, tampoco tiene "autor del flushing":
-- se guarda quién lo cargó en `creado_por`, que es quien lo puede eliminar.

ALTER TABLE embrion ALTER COLUMN flushing_id DROP NOT NULL;

ALTER TABLE embrion ADD COLUMN creado_por UUID REFERENCES usuario(id);

-- Todo embrión sale de un flushing o tiene quién lo cargó.
ALTER TABLE embrion ADD CONSTRAINT embrion_origen_chk
  CHECK (flushing_id IS NOT NULL OR creado_por IS NOT NULL);

DROP POLICY IF EXISTS embrion_insert ON embrion;
CREATE POLICY embrion_insert ON embrion FOR INSERT WITH CHECK (
  -- Desde un flushing: como hasta ahora.
  (flushing_id IS NOT NULL AND vet_tiene_acceso(caballo_donante_id))
  OR (
    -- Carga manual: solo vitrificado, a nombre de quien lo carga y con la
    -- donante perteneciendo a la sociedad del embrión.
    flushing_id IS NULL
    AND estado     = 'congelado'
    AND creado_por = auth.uid()
    AND EXISTS (
      SELECT 1 FROM caballo c
       WHERE c.id = caballo_donante_id
         AND c.sociedad_id = embrion.sociedad_id
    )
    AND (vet_tiene_acceso(caballo_donante_id) OR es_admin(sociedad_id))
  )
);

-- Borrado: el autor del flushing, o quien cargó el embrión manual.
CREATE OR REPLACE FUNCTION public.eliminar_embrion_cria(p_embrion_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_flushing uuid;
  v_autor    uuid;
BEGIN
  SELECT e.flushing_id, COALESCE(f.veterinario_id, e.creado_por) INTO v_flushing, v_autor
    FROM embrion e
    LEFT JOIN cria_flushing f ON f.id = e.flushing_id
   WHERE e.id = p_embrion_id
   FOR UPDATE OF e;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El embrión no existe.';
  END IF;
  IF v_autor IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo quien cargó el embrión (o su flushing) puede eliminarlo.';
  END IF;
  IF EXISTS (SELECT 1 FROM cria_transferencia WHERE embrion_id = p_embrion_id) THEN
    RAISE EXCEPTION 'El embrión ya se transfirió: eliminá primero la transferencia.';
  END IF;

  DELETE FROM embrion WHERE id = p_embrion_id;

  -- El embrión manual no descuenta de ningún flushing.
  IF v_flushing IS NOT NULL THEN
    UPDATE cria_flushing
       SET cantidad = GREATEST(COALESCE(cantidad, 1) - 1, 0), updated_at = now()
     WHERE id = v_flushing;
  END IF;
END;
$function$;
