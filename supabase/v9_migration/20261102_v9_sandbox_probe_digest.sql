-- DELTA OPS V9 / 4O: ampliar el probe ACK existente, SOLO SANDBOX.
-- Aplicar únicamente sobre biztlietuvvonigcfdwy. No toca V8.1 ni public.rop05 productivo.
-- No incorpora activadores, envíos, escritores ni nuevos módulos .gs.
DO $guard$
BEGIN
  IF to_regprocedure('public.v9_ingest_accept_batch_v1(uuid,text,jsonb)') IS NULL
     OR to_regclass('public.v9_ingest_versions') IS NULL
     OR to_regclass('public.v9_operational_rows') IS NULL THEN
    RAISE EXCEPTION 'V9_PROBE_SANDBOX_RECEIVER_REQUIRED';
  END IF;
END
$guard$;

CREATE OR REPLACE FUNCTION public.v9_ingest_probe_v1(
 p_dataset text,
 p_record_ids text[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  v_count := coalesce(cardinality(p_record_ids), 0);
  IF v_count < 1 OR v_count > 100
     OR p_dataset IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.v9_dataset_catalog
       WHERE dataset = p_dataset
     )
     OR EXISTS (
       SELECT 1 FROM unnest(p_record_ids) AS i
       WHERE i IS NULL OR length(i) NOT BETWEEN 1 AND 200
     )
  THEN
    RAISE EXCEPTION 'V9_BAD_PROBE';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'record_id', record_id,
      'delivery_revision', delivery_revision,
      'payload_sha256', payload_sha256,
      'digest_verified', payload_sha256 = encode(
        sha256(convert_to(payload::text, 'UTF8')), 'hex'
      ),
      'source_sha256', payload->'_v9'->>'source_sha256',
      'productivity_state', payload->'_v9'->>'productivity_state',
      'publication_status', payload->'_v9'->>'publication_status'
    ) ORDER BY record_id)
    FROM public.v9_operational_rows
    WHERE dataset = p_dataset AND record_id = ANY(p_record_ids)
  ), '[]'::jsonb);
END
$function$;

-- Mantener acceso estricto al rol servidor; nunca al navegador.
REVOKE ALL ON FUNCTION public.v9_ingest_probe_v1(text,text[])
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v9_ingest_probe_v1(text,text[])
TO service_role;

COMMENT ON FUNCTION public.v9_ingest_probe_v1(text,text[]) IS
'V9 sandbox: consulta de revision y SHA256 remoto por identidad para reconciliar timeout/ACK. No publica; no confundir con ACK de produccion.';
