-- Protocolos reproductivos integrales: estado operativo separado de un
-- historial append-only y decisiones atomicas para ECOs/ovulaciones.

ALTER TABLE public.caballo DROP CONSTRAINT IF EXISTS caballo_estado_reproductivo_check;
ALTER TABLE public.caballo ADD CONSTRAINT caballo_estado_reproductivo_check CHECK (
  estado_reproductivo IS NULL OR estado_reproductivo = ANY (ARRAY[
    'revision','strelling','inseminacion','oxy','ov','flushing','pg','espera',
    'sincronizando','disponible','lista_transferencia','transferida','pendiente_eco',
    'eco1','eco2','eco3','prenada','vacia','volviendo_sincronizar'
  ])
);

ALTER TABLE public.cria_registro_clinico ADD COLUMN IF NOT EXISTS fecha_flushing_programada date;
ALTER TABLE public.cria_recordatorio
  ADD COLUMN IF NOT EXISTS transferencia_id uuid REFERENCES public.cria_transferencia(id),
  ADD COLUMN IF NOT EXISTS eco_numero smallint CHECK (eco_numero IS NULL OR eco_numero BETWEEN 1 AND 3);

UPDATE public.cria_recordatorio r SET transferencia_id=t.id,
  eco_numero=substring(r.tipo FROM '^Eco ([123])$')::smallint
FROM public.cria_transferencia t
WHERE r.origen_registro_id=t.registro_id AND r.tipo ~ '^Eco [123]$' AND r.transferencia_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_cria_recordatorio_transferencia
  ON public.cria_recordatorio (transferencia_id,eco_numero,estado) WHERE transferencia_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_cria_recordatorio_eco_abierta
  ON public.cria_recordatorio (transferencia_id,tipo)
  WHERE transferencia_id IS NOT NULL AND estado IN ('pendiente','vencido');

CREATE TABLE public.cria_seguimiento_gestacion (
  transferencia_id uuid PRIMARY KEY REFERENCES public.cria_transferencia(id) ON DELETE RESTRICT,
  sociedad_id uuid NOT NULL REFERENCES public.sociedad(id),
  caballo_receptora_id uuid NOT NULL REFERENCES public.caballo(id),
  estado text NOT NULL DEFAULT 'pendiente_eco1' CHECK (estado IN
    ('pendiente_eco1','volver_a_ver','prenada','vacia','vacia_resincronizar','finalizado')),
  eco_actual smallint NOT NULL DEFAULT 1 CHECK (eco_actual BETWEEN 1 AND 3),
  finalizado_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cria_seguimiento_receptora_activo
  ON public.cria_seguimiento_gestacion (caballo_receptora_id,updated_at DESC) WHERE finalizado_at IS NULL;
ALTER TABLE public.cria_seguimiento_gestacion ENABLE ROW LEVEL SECURITY;
CREATE POLICY cria_seguimiento_select ON public.cria_seguimiento_gestacion FOR SELECT TO authenticated
  USING (tiene_membresia(sociedad_id) OR vet_tiene_acceso(caballo_receptora_id) OR is_superadmin());
GRANT SELECT ON public.cria_seguimiento_gestacion TO authenticated;

INSERT INTO public.cria_seguimiento_gestacion
  (transferencia_id,sociedad_id,caballo_receptora_id,estado,eco_actual,finalizado_at)
SELECT t.id,t.sociedad_id,t.caballo_receptora_id,
  CASE
    WHEN EXISTS (SELECT 1 FROM cria_ecografia e WHERE e.transferencia_id=t.id AND e.resultado='prenada') THEN 'prenada'
    WHEN EXISTS (SELECT 1 FROM cria_ecografia e WHERE e.transferencia_id=t.id AND e.resultado='abortada') THEN 'vacia'
    ELSE 'pendiente_eco1'
  END,
  LEAST(COALESCE((SELECT max(e.numero)+1 FROM cria_ecografia e WHERE e.transferencia_id=t.id),1),3)::smallint,
  CASE WHEN EXISTS (SELECT 1 FROM cria_ecografia e WHERE e.transferencia_id=t.id AND e.resultado='abortada')
       THEN now() ELSE NULL END
FROM public.cria_transferencia t
ON CONFLICT DO NOTHING;

CREATE TABLE public.cria_evento_reproductivo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sociedad_id uuid NOT NULL REFERENCES public.sociedad(id),
  caballo_id uuid NOT NULL REFERENCES public.caballo(id), transferencia_id uuid REFERENCES public.cria_transferencia(id),
  registro_id uuid REFERENCES public.cria_registro_clinico(id), tipo text NOT NULL,
  datos jsonb NOT NULL DEFAULT '{}'::jsonb, creado_por uuid REFERENCES public.usuario(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cria_evento_caballo_fecha ON public.cria_evento_reproductivo(caballo_id,created_at DESC);
ALTER TABLE public.cria_evento_reproductivo ENABLE ROW LEVEL SECURITY;
CREATE POLICY cria_evento_select ON public.cria_evento_reproductivo FOR SELECT TO authenticated
  USING (tiene_membresia(sociedad_id) OR vet_tiene_acceso(caballo_id) OR is_superadmin());
GRANT SELECT ON public.cria_evento_reproductivo TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.cria_evento_reproductivo FROM anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.cria_seguimiento_gestacion FROM anon,authenticated;

ALTER TABLE public.cria_ecografia DROP CONSTRAINT IF EXISTS cria_ecografia_resultado_check;
ALTER TABLE public.cria_ecografia ADD CONSTRAINT cria_ecografia_resultado_check CHECK
  (resultado IN ('prenada','abortada','pendiente','volver_a_ver','vacia','vacia_resincronizar'));
ALTER TABLE public.cria_ecografia ADD COLUMN IF NOT EXISTS revision smallint NOT NULL DEFAULT 1 CHECK (revision>=1);
ALTER TABLE public.cria_ecografia DROP CONSTRAINT IF EXISTS cria_ecografia_transferencia_numero_uq;
ALTER TABLE public.cria_ecografia ADD CONSTRAINT cria_ecografia_transferencia_numero_revision_uq
  UNIQUE(transferencia_id,numero,revision);

CREATE OR REPLACE FUNCTION public._cria_iniciar_seguimiento_transferencia()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO cria_seguimiento_gestacion(transferencia_id,sociedad_id,caballo_receptora_id)
  VALUES(NEW.id,NEW.sociedad_id,NEW.caballo_receptora_id) ON CONFLICT DO NOTHING;
  INSERT INTO cria_evento_reproductivo(sociedad_id,caballo_id,transferencia_id,registro_id,tipo,datos,creado_por)
  VALUES(NEW.sociedad_id,NEW.caballo_receptora_id,NEW.id,NEW.registro_id,'transferencia',
    jsonb_build_object('fecha',NEW.fecha),NEW.veterinario_id);
  PERFORM _cria_cambiar_estado_reproductivo(NEW.caballo_receptora_id,NEW.sociedad_id,'pendiente_eco',
    'Transferencia registrada; ECO 1 pendiente',NEW.veterinario_id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_cria_iniciar_seguimiento_transferencia ON public.cria_transferencia;
CREATE TRIGGER trg_cria_iniciar_seguimiento_transferencia AFTER INSERT ON public.cria_transferencia
  FOR EACH ROW EXECUTE FUNCTION public._cria_iniciar_seguimiento_transferencia();

CREATE OR REPLACE FUNCTION public._cria_filtrar_recordatorio_automatico()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_estado text;
BEGIN
  IF NEW.tipo IN ('Eco 1','Eco 2','Eco 3') THEN
    IF NEW.transferencia_id IS NULL AND NEW.origen_registro_id IS NOT NULL THEN
      SELECT id INTO NEW.transferencia_id FROM cria_transferencia WHERE registro_id=NEW.origen_registro_id LIMIT 1;
    END IF;
    NEW.eco_numero:=substring(NEW.tipo FROM '^Eco ([123])$')::smallint;
    IF NEW.eco_numero>1 THEN
      SELECT estado INTO v_estado FROM cria_seguimiento_gestacion WHERE transferencia_id=NEW.transferencia_id;
      IF v_estado IS DISTINCT FROM 'prenada' THEN RETURN NULL; END IF;
    END IF;
  END IF;
  IF NEW.tipo='IN' AND NEW.origen_registro_id IS NOT NULL AND EXISTS
    (SELECT 1 FROM cria_registro_clinico WHERE id=NEW.origen_registro_id AND obs_chips @> ARRAY['IN']::text[])
  THEN RETURN NULL; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_cria_filtrar_recordatorio_automatico ON public.cria_recordatorio;
CREATE TRIGGER trg_cria_filtrar_recordatorio_automatico BEFORE INSERT ON public.cria_recordatorio
  FOR EACH ROW EXECUTE FUNCTION public._cria_filtrar_recordatorio_automatico();

CREATE OR REPLACE FUNCTION public.registrar_resultado_ecografia(
  p_transferencia_id uuid,p_numero smallint,p_fecha date,p_resultado text,
  p_ovario_izq text[] DEFAULT '{}',p_ovario_der text[] DEFAULT '{}',p_notas text DEFAULT NULL,
  p_origen_recordatorio_id uuid DEFAULT NULL,p_revision_dias smallint DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_t cria_transferencia%ROWTYPE; v_id uuid;
  v_revision smallint; v_eco2 smallint; v_eco3 smallint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión no autenticada'; END IF;
  IF p_numero NOT BETWEEN 1 AND 3 OR p_resultado NOT IN ('prenada','volver_a_ver','vacia','vacia_resincronizar')
    THEN RAISE EXCEPTION 'Resultado de ECO inválido'; END IF;
  IF p_resultado='volver_a_ver' AND (p_revision_dias IS NULL OR p_revision_dias NOT BETWEEN 1 AND 120)
    THEN RAISE EXCEPTION 'Indicá entre 1 y 120 días para volver a ver'; END IF;
  SELECT * INTO v_t FROM cria_transferencia WHERE id=p_transferencia_id FOR UPDATE;
  IF NOT FOUND OR NOT vet_tiene_acceso(v_t.caballo_receptora_id) THEN
    RAISE EXCEPTION 'Transferencia inexistente o sin acceso'; END IF;
  IF NOT _cria_transferencia_vigente(v_t.id) THEN RAISE EXCEPTION 'La transferencia ya no está vigente'; END IF;
  SELECT COALESCE(max(revision),0)+1 INTO v_revision FROM cria_ecografia
    WHERE transferencia_id=v_t.id AND numero=p_numero;
  INSERT INTO cria_ecografia(sociedad_id,transferencia_id,caballo_receptora_id,veterinario_id,
    numero,revision,fecha,resultado,ovario_izq,ovario_der,notas,origen_recordatorio_id)
  VALUES(v_t.sociedad_id,v_t.id,v_t.caballo_receptora_id,v_uid,p_numero,v_revision,p_fecha,p_resultado,
    p_ovario_izq,p_ovario_der,p_notas,p_origen_recordatorio_id) RETURNING id INTO v_id;
  UPDATE cria_recordatorio SET estado='hecho',updated_at=now()
    WHERE id=p_origen_recordatorio_id AND estado IN ('pendiente','vencido');
  INSERT INTO cria_evento_reproductivo(sociedad_id,caballo_id,transferencia_id,tipo,datos,creado_por)
  VALUES(v_t.sociedad_id,v_t.caballo_receptora_id,v_t.id,'ecografia',
    jsonb_build_object('eco',p_numero,'revision',v_revision,'fecha',p_fecha,'resultado',p_resultado),v_uid);
  IF p_resultado='prenada' THEN
    UPDATE cria_seguimiento_gestacion SET estado='prenada',eco_actual=LEAST(p_numero+1,3),updated_at=now()
      WHERE transferencia_id=v_t.id;
    SELECT receptora_transf_a_eco2,receptora_transf_a_eco3 INTO v_eco2,v_eco3 FROM cria_plazo_vet WHERE veterinario_id=v_uid;
    INSERT INTO cria_recordatorio(caballo_id,sociedad_id,tipo,fecha_vto,estado,veterinario_id,auto_generado,
      origen_registro_id,transferencia_id,eco_numero) VALUES
      (v_t.caballo_receptora_id,v_t.sociedad_id,'Eco 2',v_t.fecha+COALESCE(v_eco2,60),'pendiente',v_uid,true,v_t.registro_id,v_t.id,2),
      (v_t.caballo_receptora_id,v_t.sociedad_id,'Eco 3',v_t.fecha+COALESCE(v_eco3,90),'pendiente',v_uid,true,v_t.registro_id,v_t.id,3)
    ON CONFLICT DO NOTHING;
  ELSIF p_resultado='volver_a_ver' THEN
    UPDATE cria_seguimiento_gestacion SET estado='volver_a_ver',eco_actual=p_numero,updated_at=now() WHERE transferencia_id=v_t.id;
    INSERT INTO cria_recordatorio(caballo_id,sociedad_id,tipo,fecha_vto,estado,veterinario_id,auto_generado,
      origen_registro_id,transferencia_id,eco_numero,notas)
    VALUES(v_t.caballo_receptora_id,v_t.sociedad_id,'Revisión Eco',p_fecha+p_revision_dias,'pendiente',v_uid,true,
      v_t.registro_id,v_t.id,p_numero,format('Volver a ver ECO %s en %s días',p_numero,p_revision_dias));
    PERFORM _cria_cambiar_estado_reproductivo(v_t.caballo_receptora_id,v_t.sociedad_id,'pendiente_eco',
      format('ECO %s: volver a ver',p_numero),v_uid);
  ELSE
    UPDATE cria_seguimiento_gestacion SET estado=p_resultado,finalizado_at=now(),updated_at=now() WHERE transferencia_id=v_t.id;
    UPDATE caballo SET prenada=false,fecha_prenez=NULL,updated_at=now() WHERE id=v_t.caballo_receptora_id;
    UPDATE cria_recordatorio SET estado='cancelado',cancel_motivo='Seguimiento finalizado',updated_at=now()
      WHERE transferencia_id=v_t.id AND estado IN ('pendiente','vencido');
    PERFORM _cria_cambiar_estado_reproductivo(v_t.caballo_receptora_id,v_t.sociedad_id,
      CASE WHEN p_resultado='vacia_resincronizar' THEN 'volviendo_sincronizar' ELSE 'vacia' END,
      format('ECO %s: %s',p_numero,p_resultado),v_uid);
  END IF;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_resultado_ecografia(uuid,smallint,date,text,text[],text[],text,uuid,smallint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registrar_resultado_ecografia(uuid,smallint,date,text,text[],text[],text,uuid,smallint) TO authenticated;

CREATE OR REPLACE FUNCTION public.editar_ovulacion(p_registro_id uuid,p_fecha date,p_fecha_flushing date,
  p_veterinario_id uuid,p_caballo_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_old cria_registro_clinico%ROWTYPE;
BEGIN
  SELECT * INTO v_old FROM cria_registro_clinico WHERE id=p_registro_id FOR UPDATE;
  IF NOT FOUND OR NOT (v_old.ovario_izq @> ARRAY['OV']::text[] OR v_old.ovario_der @> ARRAY['OV']::text[])
    THEN RAISE EXCEPTION 'La ovulación no existe'; END IF;
  IF v_uid IS NULL OR NOT vet_tiene_acceso(v_old.caballo_id) OR NOT vet_tiene_acceso(p_caballo_id)
    THEN RAISE EXCEPTION 'Sin permiso para editar la ovulación'; END IF;
  UPDATE cria_registro_clinico SET fecha=p_fecha,fecha_flushing_programada=p_fecha_flushing,
    veterinario_id=p_veterinario_id,caballo_id=p_caballo_id,updated_at=now() WHERE id=p_registro_id;
  UPDATE cria_recordatorio SET caballo_id=p_caballo_id,veterinario_id=p_veterinario_id,
    fecha_vto=CASE WHEN tipo='Flushing' THEN p_fecha_flushing ELSE p_fecha+(fecha_vto-v_old.fecha) END,updated_at=now()
    WHERE origen_registro_id=p_registro_id AND estado IN ('pendiente','vencido');
  INSERT INTO cria_evento_reproductivo(sociedad_id,caballo_id,registro_id,tipo,datos,creado_por)
  VALUES(v_old.sociedad_id,p_caballo_id,p_registro_id,'ovulacion_editada',
    jsonb_build_object('anterior',jsonb_build_object('fecha',v_old.fecha,'fecha_flushing',v_old.fecha_flushing_programada,
      'veterinario_id',v_old.veterinario_id,'caballo_id',v_old.caballo_id),
      'nuevo',jsonb_build_object('fecha',p_fecha,'fecha_flushing',p_fecha_flushing,
      'veterinario_id',p_veterinario_id,'caballo_id',p_caballo_id)),v_uid);
END $$;
REVOKE ALL ON FUNCTION public.editar_ovulacion(uuid,date,date,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.editar_ovulacion(uuid,date,date,uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public._cria_auditar_correccion_ecografia()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW) THEN
    INSERT INTO cria_evento_reproductivo(sociedad_id,caballo_id,transferencia_id,tipo,datos,creado_por)
    VALUES(OLD.sociedad_id,OLD.caballo_receptora_id,OLD.transferencia_id,'ecografia_corregida',
      jsonb_build_object('anterior',to_jsonb(OLD),'nuevo',to_jsonb(NEW)),COALESCE(auth.uid(),NEW.veterinario_id));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_cria_auditar_correccion_ecografia ON public.cria_ecografia;
CREATE TRIGGER trg_cria_auditar_correccion_ecografia BEFORE UPDATE ON public.cria_ecografia
  FOR EACH ROW EXECUTE FUNCTION public._cria_auditar_correccion_ecografia();
