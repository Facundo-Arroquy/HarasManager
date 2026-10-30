-- El vet necesita poder asignar sus caballos propios a sus campos. La única
-- policy de UPDATE sobre `caballo` es `es_admin(sociedad_id)`, así que el vet
-- edita siempre por esta RPC: se le agrega `p_campo_id`.
--
-- La coherencia entre el campo y el dueño del caballo NO se valida acá: la
-- garantiza el trigger `trg_validar_campo_caballo`, que corre igual aunque la
-- función sea SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.actualizar_caballo_veterinario(
  p_caballo_id uuid,
  p_nombre text,
  p_fecha_nacimiento date,
  p_categoria text,
  p_subcategoria text DEFAULT NULL::text,
  p_raza_id integer DEFAULT NULL::integer,
  p_pelaje_id integer DEFAULT NULL::integer,
  p_numero_chip text DEFAULT NULL::text,
  p_numero_registro text DEFAULT NULL::text,
  p_padre_id uuid DEFAULT NULL::uuid,
  p_padre_nombre text DEFAULT NULL::text,
  p_madre_id uuid DEFAULT NULL::uuid,
  p_madre_nombre text DEFAULT NULL::text,
  p_campo_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (
    vet_tiene_acceso(p_caballo_id)
    OR EXISTS (
      SELECT 1 FROM caballo
      WHERE id = p_caballo_id AND vet_owner_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Sin acceso al caballo';
  END IF;

  UPDATE caballo SET
    nombre           = p_nombre,
    fecha_nacimiento = p_fecha_nacimiento,
    categoria        = p_categoria,
    rol_reproductivo = p_subcategoria,
    raza_id          = p_raza_id,
    pelaje_id        = p_pelaje_id,
    numero_chip      = p_numero_chip,
    numero_registro  = p_numero_registro,
    padre_id         = p_padre_id,
    padre_nombre     = p_padre_nombre,
    madre_id         = p_madre_id,
    madre_nombre     = p_madre_nombre,
    campo_id         = p_campo_id
  WHERE id = p_caballo_id;
END;
$function$;
