-- Recovery strictly INSERT-ONLY for rop02_jm; current production delta RPC remains unchanged.
CREATE OR REPLACE FUNCTION public.rop02_jm_insert_missing_only_v1(p_rows jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_input integer := 0;
  v_inserted integer := 0;
BEGIN
  IF jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'p_rows debe ser array';
  END IF;
  v_input := jsonb_array_length(coalesce(p_rows, '[]'::jsonb));
  IF v_input > 1200 THEN RAISE EXCEPTION 'Demasiadas filas de recuperación'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) AS x
    WHERE coalesce(x->>'source_row','') !~ '^[1-9][0-9]*$'
       OR (x->>'source_row')::bigint <= 4
       OR (x->>'source_row')::bigint > 100000000
       OR coalesce(x->>'fecha','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       OR btrim(coalesce(x->>'interno','')) = ''
  ) THEN RAISE EXCEPTION 'Parte inválido o incompleto'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) AS x
    GROUP BY (x->>'source_row')::integer HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'source_row duplicado'; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('delta_external_sheet_sync|rop02_jm'));
  INSERT INTO public.rop02(
    source_dataset, source_row, fecha, interno, equipo, operador,
    supervisor_delta, supervisor_vial_cliente, turno_trabajo, numero_parte,
    proyecto, horometro_inicial, horometro_final, cantidad_horas, combustible,
    aceite, aceite_text, descripcion_trabajos, informacion_desgaste,
    observaciones, source_key, synced_at, updated_at
  )
  SELECT
    'rop02_jm', (x->>'source_row')::integer, (x->>'fecha')::date,
    btrim(coalesce(x->>'interno','')), btrim(coalesce(x->>'equipo','')),
    btrim(coalesce(x->>'operador','')), btrim(coalesce(x->>'supervisor_delta','')),
    btrim(coalesce(x->>'supervisor_vial_cliente','')), btrim(coalesce(x->>'turno_trabajo','')),
    btrim(coalesce(x->>'numero_parte','')), 'JOSE MARIA',
    nullif(x->>'horometro_inicial','')::numeric, nullif(x->>'horometro_final','')::numeric,
    nullif(x->>'cantidad_horas','')::numeric, nullif(x->>'combustible','')::numeric,
    nullif(x->>'aceite_num','')::numeric, btrim(coalesce(x->>'aceite','')),
    btrim(coalesce(x->>'descripcion_trabajos','')),
    btrim(coalesce(x->>'informacion_desgaste','')),
    btrim(coalesce(x->>'observaciones','')),
    'SRC|ROP02_JM|' || (x->>'source_row'), now(), now()
  FROM jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) AS x
  ON CONFLICT (source_dataset,source_row) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN jsonb_build_object('ok',true,'dataset','rop02_jm',
          'inputUpserts',v_input,'insertedRows',v_inserted,'insertOnly',true);
END;
$function$;
REVOKE ALL ON FUNCTION public.rop02_jm_insert_missing_only_v1(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rop02_jm_insert_missing_only_v1(jsonb) TO service_role;
-- ROLLBACK: DROP FUNCTION IF EXISTS public.rop02_jm_insert_missing_only_v1(jsonb);
