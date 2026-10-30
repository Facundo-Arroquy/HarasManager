-- =============================================================================
-- 06 · Centro de cría
--
-- Los registros, transferencias y ecografías se cargan llamando a las MISMAS
-- funciones que usa la app (registrar_acto_reproductivo,
-- registrar_transferencia_embrionaria, registrar_resultado_ecografia) para que
-- los recordatorios, la preñez y el pipeline queden como los dejaría el uso real.
-- Esas funciones leen auth.uid(): se lo fija con request.jwt.claims.
--
-- Las fechas son relativas a hoy ("hoy - 42" = hace 42 días).
--
-- Haras Demo 1 · vet.demo1
--   Donante Estrella del Alba (01) × Pampero (06): ciclo completo → flushing con
--   4 embriones (2 frescos, 2 congelados) → 2 transferencias frescas
--   (Tormenta 03 queda preñada; Brisa Marina 04 vacía) y una de vitrificado
--   (Candela 05, eco pendiente). Luna Llena (02) arranca un ciclo nuevo.
-- Haras Demo 2 · vet.demo2
--   Dulce de Leche (13) y Pimienta (14): dos flushings, cuatro receptoras
--   (una con Eco 1 pendiente, una preñada con 2 ecos, una abortada).
-- vet.independiente.demo (sin membresía, con plazos propios)
--   Registra el ciclo nuevo de Luna Llena (02) gracias a su acceso por caballo.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Acciones (chips) de cada veterinario: la lista es del vet, no de la sociedad
-- ---------------------------------------------------------------------------
INSERT INTO public.cat_chip_obs (veterinario_id, nombre)
SELECT v.id, c.nombre
FROM (VALUES
  ('a0000001-0000-4000-8000-000000000004'::uuid),
  ('a0000001-0000-4000-8000-000000000005'::uuid),
  ('a0000001-0000-4000-8000-000000000006'::uuid)
) AS v(id)
CROSS JOIN (VALUES
  ('Strelin'), ('IN'), ('OXI'), ('PG'), ('1PG'), ('Flushing'), ('Transferida'), ('P4'), ('Revisar mañana')
) AS c(nombre);

-- ---------------------------------------------------------------------------
-- Plazos: vet.demo1 y vet.demo2 usan los del sistema (no tienen fila).
-- vet.independiente tiene los propios: el plazo que se aplica es el del vet que
-- firma el registro.
-- ---------------------------------------------------------------------------
INSERT INTO public.cria_plazo_vet (
  veterinario_id, donante_strelin_a_in, donante_in_a_oxi,
  receptora_transf_a_eco1, receptora_transf_a_eco2, receptora_transf_a_eco3
) VALUES ('a0000001-0000-4000-8000-000000000006', 2, 1, 28, 56, 84);

-- ---------------------------------------------------------------------------
-- Haras Demo 1 · vet.demo1
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  hoy     date    := current_date;
  vacio   text[]  := ARRAY[]::text[];
  v_vet   uuid    := 'a0000001-0000-4000-8000-000000000004';
  v_soc   uuid    := 'b0000001-0000-4000-8000-000000000001';
  don1    uuid    := 'd0000001-0000-4000-8000-000000000001';  -- Estrella del Alba
  don2    uuid    := 'd0000001-0000-4000-8000-000000000002';  -- Luna Llena
  r3      uuid    := 'd0000001-0000-4000-8000-000000000003';  -- Tormenta
  r4      uuid    := 'd0000001-0000-4000-8000-000000000004';  -- Brisa Marina
  r5      uuid    := 'd0000001-0000-4000-8000-000000000005';  -- Candela
  pad     uuid    := 'd0000001-0000-4000-8000-000000000006';  -- Pampero
  v_fl    uuid    := 'e6000001-0000-4000-8000-000000000001';
  e1      uuid    := 'e7000001-0000-4000-8000-000000000001';
  e2      uuid    := 'e7000001-0000-4000-8000-000000000002';
  e3      uuid    := 'e7000001-0000-4000-8000-000000000003';
  e4      uuid    := 'e7000001-0000-4000-8000-000000000004';
  v_res   jsonb;
  v_tr3   uuid;
  v_tr4   uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_vet, 'role', 'authenticated')::text, true);

  -- Ciclo de la donante: Strelin → IN con Pampero → OXI → ovulación
  PERFORM public.registrar_acto_reproductivo(p_caballo_id => don1, p_sociedad_id => v_soc, p_fecha => hoy - 52,
    p_ovario_izq => vacio, p_ovario_der => vacio, p_utero => vacio, p_obs_chips => ARRAY['Strelin'],
    p_observaciones => 'Inicio del ciclo', p_veterinario_id => v_vet, p_rol_reproductivo => 'Donante');
  PERFORM public.registrar_acto_reproductivo(p_caballo_id => don1, p_sociedad_id => v_soc, p_fecha => hoy - 51,
    p_ovario_izq => vacio, p_ovario_der => vacio, p_utero => vacio, p_obs_chips => ARRAY['IN'],
    p_observaciones => 'Inseminada con Pampero', p_veterinario_id => v_vet, p_rol_reproductivo => 'Donante',
    p_padrillo_id => pad);
  PERFORM public.registrar_acto_reproductivo(p_caballo_id => don1, p_sociedad_id => v_soc, p_fecha => hoy - 50,
    p_ovario_izq => vacio, p_ovario_der => vacio, p_utero => vacio, p_obs_chips => ARRAY['OXI'],
    p_observaciones => NULL, p_veterinario_id => v_vet, p_rol_reproductivo => 'Donante');
  PERFORM public.registrar_acto_reproductivo(p_caballo_id => don1, p_sociedad_id => v_soc, p_fecha => hoy - 48,
    p_ovario_izq => ARRAY['OV'], p_ovario_der => vacio, p_utero => vacio, p_obs_chips => vacio,
    p_observaciones => 'Ovulación', p_veterinario_id => v_vet, p_rol_reproductivo => 'Donante',
    p_ov_dias => 0::smallint);

  -- Flushing (hace 42 días) y sus 4 embriones
  INSERT INTO public.cria_flushing (id, caballo_id, sociedad_id, fecha, veterinario_id, es_negativo, cantidad, padrillo_id, pg_given, notas)
  VALUES (v_fl, don1, v_soc, hoy - 42, v_vet, false, 4, pad, false, 'Lavado de prueba');
  PERFORM public.cerrar_recordatorios_flushing(don1, v_fl);

  INSERT INTO public.embrion (id, sociedad_id, flushing_id, padrillo_id, caballo_donante_id, estadio, grado, tamanio, zona_pelucida, estado, creado_por, fecha_extraccion, lugar_almacenamiento) VALUES
    (e1, v_soc, v_fl, pad, don1, 'Blastocisto',           1, '180 µm', 'Intacta', 'disponible', v_vet, hoy - 42, NULL),
    (e2, v_soc, v_fl, pad, don1, 'Blastocisto expandido', 1, '240 µm', 'Intacta', 'disponible', v_vet, hoy - 42, NULL),
    (e3, v_soc, v_fl, pad, don1, 'Blastocisto',           2, '170 µm', 'Intacta', 'congelado',  v_vet, hoy - 42, 'Tanque 1 — caña 3'),
    (e4, v_soc, v_fl, pad, don1, 'Mórula',                3, '120 µm', 'Intacta', 'congelado',  v_vet, hoy - 42, 'Tanque 1 — caña 4');

  -- Dos transferencias frescas el mismo día del flushing
  v_res := public.registrar_transferencia_embrionaria(p_sociedad_id => v_soc, p_fecha => hoy - 42,
    p_caballo_receptora_id => r3, p_caballo_donante_id => don1, p_embrion_id => e1,
    p_padrillo_id => pad, p_flushing_id => v_fl, p_ovario_izq => ARRAY['CL'], p_ovario_der => vacio,
    p_cl_calidad => 'Buena', p_tono_uterino => 'Bueno', p_tono_cervical => 'Cerrado');
  v_tr3 := (v_res->>'transferencia_id')::uuid;

  v_res := public.registrar_transferencia_embrionaria(p_sociedad_id => v_soc, p_fecha => hoy - 42,
    p_caballo_receptora_id => r4, p_caballo_donante_id => don1, p_embrion_id => e2,
    p_padrillo_id => pad, p_flushing_id => v_fl, p_ovario_izq => vacio, p_ovario_der => ARRAY['CL'],
    p_cl_calidad => 'Regular', p_tono_uterino => 'Bueno', p_tono_cervical => 'Cerrado');
  v_tr4 := (v_res->>'transferencia_id')::uuid;

  -- Eco 1 (a los 30 días): Tormenta preñada, Brisa Marina vacía
  PERFORM public.registrar_resultado_ecografia(v_tr3, 1::smallint, hoy - 12, 'prenada');
  PERFORM public.registrar_resultado_ecografia(v_tr4, 1::smallint, hoy - 12, 'vacia');

  -- Transferencia de un embrión vitrificado a Candela (hace 3 días): Eco 1 pendiente
  PERFORM public.registrar_transferencia_embrionaria(p_sociedad_id => v_soc, p_fecha => hoy - 3,
    p_caballo_receptora_id => r5, p_caballo_donante_id => don1, p_embrion_id => e3,
    p_padrillo_id => pad, p_flushing_id => v_fl, p_ovario_izq => ARRAY['CL'], p_ovario_der => vacio,
    p_cl_calidad => 'Buena', p_tono_uterino => 'Bueno', p_tono_cervical => 'Cerrado');

  -- Brisa Marina vuelve a sincronizarse
  PERFORM public.registrar_acto_reproductivo(p_caballo_id => r4, p_sociedad_id => v_soc, p_fecha => hoy - 2,
    p_ovario_izq => vacio, p_ovario_der => vacio, p_utero => vacio, p_obs_chips => ARRAY['Strelin'],
    p_observaciones => 'Nueva sincronización', p_veterinario_id => v_vet, p_rol_reproductivo => 'Receptora');

  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- ---------------------------------------------------------------------------
-- Haras Demo 2 · vet.demo2
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  hoy     date    := current_date;
  vacio   text[]  := ARRAY[]::text[];
  v_vet   uuid    := 'a0000001-0000-4000-8000-000000000005';
  v_soc   uuid    := 'b0000001-0000-4000-8000-000000000002';
  don13   uuid    := 'd0000001-0000-4000-8000-000000000013';  -- Dulce de Leche
  don14   uuid    := 'd0000001-0000-4000-8000-000000000014';  -- Pimienta
  r15     uuid    := 'd0000001-0000-4000-8000-000000000015';  -- Garúa
  r16     uuid    := 'd0000001-0000-4000-8000-000000000016';  -- Escarcha
  r17     uuid    := 'd0000001-0000-4000-8000-000000000017';  -- Mandarina
  r18     uuid    := 'd0000001-0000-4000-8000-000000000018';  -- Zonda
  pad19   uuid    := 'd0000001-0000-4000-8000-000000000019';  -- Cacique
  pad20   uuid    := 'd0000001-0000-4000-8000-000000000020';  -- Facón
  v_fl1   uuid    := 'e6000001-0000-4000-8000-000000000002';
  v_fl2   uuid    := 'e6000001-0000-4000-8000-000000000003';
  v_res   jsonb;
  v_t17   uuid;
  v_t18   uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_vet, 'role', 'authenticated')::text, true);


  -- Primer ciclo (Pimienta × Facón), hace ~80 días
  PERFORM public.registrar_acto_reproductivo(p_caballo_id => don14, p_sociedad_id => v_soc, p_fecha => hoy - 85,
    p_ovario_izq => vacio, p_ovario_der => vacio, p_utero => vacio, p_obs_chips => ARRAY['Strelin'],
    p_observaciones => NULL, p_veterinario_id => v_vet, p_rol_reproductivo => 'Donante');
  PERFORM public.registrar_acto_reproductivo(p_caballo_id => don14, p_sociedad_id => v_soc, p_fecha => hoy - 84,
    p_ovario_izq => vacio, p_ovario_der => vacio, p_utero => vacio, p_obs_chips => ARRAY['IN'],
    p_observaciones => NULL, p_veterinario_id => v_vet, p_rol_reproductivo => 'Donante', p_padrillo_id => pad20);
  PERFORM public.registrar_acto_reproductivo(p_caballo_id => don14, p_sociedad_id => v_soc, p_fecha => hoy - 83,
    p_ovario_izq => vacio, p_ovario_der => vacio, p_utero => vacio, p_obs_chips => ARRAY['OXI'],
    p_observaciones => NULL, p_veterinario_id => v_vet, p_rol_reproductivo => 'Donante');
  PERFORM public.registrar_acto_reproductivo(p_caballo_id => don14, p_sociedad_id => v_soc, p_fecha => hoy - 81,
    p_ovario_izq => vacio, p_ovario_der => ARRAY['OV'], p_utero => vacio, p_obs_chips => vacio,
    p_observaciones => 'Ovulación', p_veterinario_id => v_vet, p_rol_reproductivo => 'Donante',
    p_ov_dias => 0::smallint);

  INSERT INTO public.cria_flushing (id, caballo_id, sociedad_id, fecha, veterinario_id, es_negativo, cantidad, padrillo_id, pg_given)
  VALUES (v_fl1, don14, v_soc, hoy - 75, v_vet, false, 2, pad20, false);
  PERFORM public.cerrar_recordatorios_flushing(don14, v_fl1);

  INSERT INTO public.embrion (id, sociedad_id, flushing_id, padrillo_id, caballo_donante_id, estadio, grado, estado, creado_por, fecha_extraccion) VALUES
    ('e7000001-0000-4000-8000-000000000011', v_soc, v_fl1, pad20, don14, 'Blastocisto', 1, 'disponible', v_vet, hoy - 75),
    ('e7000001-0000-4000-8000-000000000012', v_soc, v_fl1, pad20, don14, 'Blastocisto', 2, 'disponible', v_vet, hoy - 75);

  v_res := public.registrar_transferencia_embrionaria(p_sociedad_id => v_soc, p_fecha => hoy - 75,
    p_caballo_receptora_id => r17, p_caballo_donante_id => don14,
    p_embrion_id => 'e7000001-0000-4000-8000-000000000011', p_padrillo_id => pad20, p_flushing_id => v_fl1);
  v_t17 := (v_res->>'transferencia_id')::uuid;
  v_res := public.registrar_transferencia_embrionaria(p_sociedad_id => v_soc, p_fecha => hoy - 75,
    p_caballo_receptora_id => r18, p_caballo_donante_id => don14,
    p_embrion_id => 'e7000001-0000-4000-8000-000000000012', p_padrillo_id => pad20, p_flushing_id => v_fl1);
  v_t18 := (v_res->>'transferencia_id')::uuid;

  -- Mandarina: preñada en la Eco 1 y la Eco 2.
  -- Zonda: preñada en las dos, y la Eco 2 se corrige a 'abortada'. La función no
  -- acepta 'abortada': igual que en la app, se edita la eco y el trigger
  -- sincronizar_prenez_ecografia le saca la preñez a la yegua.
  PERFORM public.registrar_resultado_ecografia(v_t17, 1::smallint, hoy - 45, 'prenada');
  PERFORM public.registrar_resultado_ecografia(v_t17, 2::smallint, hoy - 15, 'prenada');
  PERFORM public.registrar_resultado_ecografia(v_t18, 1::smallint, hoy - 45, 'prenada');
  PERFORM public.registrar_resultado_ecografia(v_t18, 2::smallint, hoy - 15, 'prenada');
  UPDATE public.cria_ecografia SET resultado = 'abortada' WHERE transferencia_id = v_t18 AND numero = 2;

  -- Segundo ciclo (Dulce de Leche × Cacique), hace ~35 días
  PERFORM public.registrar_acto_reproductivo(p_caballo_id => don13, p_sociedad_id => v_soc, p_fecha => hoy - 35,
    p_ovario_izq => vacio, p_ovario_der => vacio, p_utero => vacio, p_obs_chips => ARRAY['Strelin'],
    p_observaciones => NULL, p_veterinario_id => v_vet, p_rol_reproductivo => 'Donante');
  PERFORM public.registrar_acto_reproductivo(p_caballo_id => don13, p_sociedad_id => v_soc, p_fecha => hoy - 34,
    p_ovario_izq => vacio, p_ovario_der => vacio, p_utero => vacio, p_obs_chips => ARRAY['IN'],
    p_observaciones => NULL, p_veterinario_id => v_vet, p_rol_reproductivo => 'Donante', p_padrillo_id => pad19);
  PERFORM public.registrar_acto_reproductivo(p_caballo_id => don13, p_sociedad_id => v_soc, p_fecha => hoy - 33,
    p_ovario_izq => vacio, p_ovario_der => vacio, p_utero => vacio, p_obs_chips => ARRAY['OXI'],
    p_observaciones => NULL, p_veterinario_id => v_vet, p_rol_reproductivo => 'Donante');
  PERFORM public.registrar_acto_reproductivo(p_caballo_id => don13, p_sociedad_id => v_soc, p_fecha => hoy - 31,
    p_ovario_izq => ARRAY['OV'], p_ovario_der => vacio, p_utero => vacio, p_obs_chips => vacio,
    p_observaciones => 'Ovulación', p_veterinario_id => v_vet, p_rol_reproductivo => 'Donante',
    p_ov_dias => 0::smallint);

  INSERT INTO public.cria_flushing (id, caballo_id, sociedad_id, fecha, veterinario_id, es_negativo, cantidad, padrillo_id, pg_given)
  VALUES (v_fl2, don13, v_soc, hoy - 25, v_vet, false, 1, pad19, false);
  PERFORM public.cerrar_recordatorios_flushing(don13, v_fl2);

  INSERT INTO public.embrion (id, sociedad_id, flushing_id, padrillo_id, caballo_donante_id, estadio, grado, estado, creado_por, fecha_extraccion)
  VALUES ('e7000001-0000-4000-8000-000000000013', v_soc, v_fl2, pad19, don13, 'Blastocisto expandido', 1, 'disponible', v_vet, hoy - 25);

  -- Garúa recibe el embrión fresco: la Eco 1 vence en unos 5 días
  PERFORM public.registrar_transferencia_embrionaria(p_sociedad_id => v_soc, p_fecha => hoy - 25,
    p_caballo_receptora_id => r15, p_caballo_donante_id => don13,
    p_embrion_id => 'e7000001-0000-4000-8000-000000000013', p_padrillo_id => pad19, p_flushing_id => v_fl2);

  -- Escarcha: ciclo de sincronización en curso
  PERFORM public.registrar_acto_reproductivo(p_caballo_id => r16, p_sociedad_id => v_soc, p_fecha => hoy - 1,
    p_ovario_izq => vacio, p_ovario_der => vacio, p_utero => vacio, p_obs_chips => ARRAY['Strelin'],
    p_observaciones => NULL, p_veterinario_id => v_vet, p_rol_reproductivo => 'Receptora');

  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- ---------------------------------------------------------------------------
-- vet.independiente.demo (sin membresía): ciclo nuevo de Luna Llena (Haras Demo 1)
-- Con sus plazos propios, la IN se agenda a los 2 días del Strelin (no a 1).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  hoy     date    := current_date;
  vacio   text[]  := ARRAY[]::text[];
  v_vet   uuid    := 'a0000001-0000-4000-8000-000000000006';
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_vet, 'role', 'authenticated')::text, true);

  PERFORM public.registrar_acto_reproductivo(p_caballo_id => 'd0000001-0000-4000-8000-000000000002',
    p_sociedad_id => 'b0000001-0000-4000-8000-000000000001', p_fecha => hoy - 1,
    p_ovario_izq => vacio, p_ovario_der => vacio, p_utero => vacio, p_obs_chips => ARRAY['Strelin'],
    p_observaciones => 'Ciclo nuevo (veterinario independiente)', p_veterinario_id => v_vet,
    p_rol_reproductivo => 'Donante');

  PERFORM set_config('request.jwt.claims', '', true);
END $$;
