-- Fuente unica de verdad para defaults, rangos y configuracion efectiva del
-- centro de cria. El frontend consume esta forma y deja de repetir valores.

CREATE OR REPLACE FUNCTION public.get_configuracion_cria_efectiva(
  p_veterinario_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.cria_plazo_vet%ROWTYPE;
  v_personalizada boolean := false;
  v_origen text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesion no autenticada';
  END IF;

  IF auth.uid() IS DISTINCT FROM p_veterinario_id
     AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT *
    INTO v_row
  FROM public.cria_plazo_vet
  WHERE veterinario_id = p_veterinario_id;

  v_personalizada := FOUND;
  v_origen := CASE WHEN v_personalizada THEN 'veterinario' ELSE 'sistema' END;

  RETURN jsonb_build_object(
    'donante_strelin_a_in', jsonb_build_object(
      'valor', COALESCE(v_row.donante_strelin_a_in, 1), 'default', 1,
      'origen', v_origen, 'min', 1, 'max', 30, 'unidad', 'dias'),
    'donante_in_a_oxi', jsonb_build_object(
      'valor', COALESCE(v_row.donante_in_a_oxi, 1), 'default', 1,
      'origen', v_origen, 'min', 1, 'max', 30, 'unidad', 'dias'),
    'donante_ov_a_flushing', jsonb_build_object(
      'valor', COALESCE(v_row.donante_ov_a_flushing, 6), 'default', 6,
      'origen', v_origen, 'min', 1, 'max', 30, 'unidad', 'dias'),
    'donante_ov_sin_in_a_dar_pg', jsonb_build_object(
      'valor', COALESCE(v_row.donante_ov_sin_in_a_dar_pg, 4), 'default', 4,
      'origen', v_origen, 'min', 1, 'max', 30, 'unidad', 'dias'),
    'donante_pg_a_revision_pg', jsonb_build_object(
      'valor', COALESCE(v_row.donante_pg_a_revision_pg, 3), 'default', 3,
      'origen', v_origen, 'min', 1, 'max', 30, 'unidad', 'dias'),
    'donante_flushing_a_revision', jsonb_build_object(
      'valor', COALESCE(v_row.donante_flushing_a_revision, 4), 'default', 4,
      'origen', v_origen, 'min', 1, 'max', 30, 'unidad', 'dias'),
    'donante_flushing_aplica_pg', jsonb_build_object(
      'valor', COALESCE(v_row.donante_flushing_aplica_pg, true), 'default', true,
      'origen', v_origen),
    'receptora_pg_a_revision_pg', jsonb_build_object(
      'valor', COALESCE(v_row.receptora_pg_a_revision_pg, 4), 'default', 4,
      'origen', v_origen, 'min', 1, 'max', 30, 'unidad', 'dias'),
    'receptora_ov_a_dar_pg', jsonb_build_object(
      'valor', COALESCE(v_row.receptora_ov_a_dar_pg, 3), 'default', 3,
      'origen', v_origen, 'min', 1, 'max', 30, 'unidad', 'dias'),
    'receptora_transf_a_eco1', jsonb_build_object(
      'valor', COALESCE(v_row.receptora_transf_a_eco1, 30), 'default', 30,
      'origen', v_origen, 'min', 1, 'max', 365, 'unidad', 'dias'),
    'receptora_transf_a_eco2', jsonb_build_object(
      'valor', COALESCE(v_row.receptora_transf_a_eco2, 60), 'default', 60,
      'origen', v_origen, 'min', 1, 'max', 365, 'unidad', 'dias'),
    'receptora_transf_a_eco3', jsonb_build_object(
      'valor', COALESCE(v_row.receptora_transf_a_eco3, 90), 'default', 90,
      'origen', v_origen, 'min', 1, 'max', 365, 'unidad', 'dias'),
    'donante_oxi_a_revision', jsonb_build_object(
      'valor', 1, 'default', 1, 'origen', 'sistema',
      'min', 1, 'max', 30, 'unidad', 'dias'),
    'ventana_inseminacion_dias', jsonb_build_object(
      'valor', 7, 'default', 7, 'origen', 'sistema',
      'min', 1, 'max', 30, 'unidad', 'dias'),
    'strelin_dias_semana', jsonb_build_object(
      'valor', to_jsonb(ARRAY[1, 3, 5]), 'default', to_jsonb(ARRAY[1, 3, 5]),
      'origen', 'sistema', 'unidad', 'dias_iso')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_configuracion_cria_efectiva(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_configuracion_cria_efectiva(uuid)
  TO authenticated;

COMMENT ON FUNCTION public.get_configuracion_cria_efectiva(uuid) IS
  'Configuracion reproductiva efectiva del veterinario, con defaults, origen y rangos para la UI.';
