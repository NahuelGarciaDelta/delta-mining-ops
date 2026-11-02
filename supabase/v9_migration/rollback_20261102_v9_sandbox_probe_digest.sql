-- SOLO SANDBOX biztlietuvvonigcfdwy: restaurar funcion previa a Fase 4O.
-- Restauracion de definicion exacta leida antes del cambio (sin datos operativos).
CREATE OR REPLACE FUNCTION public.v9_ingest_probe_v1(p_dataset text, p_record_ids text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_count integer;
begin
 v_count:=coalesce(cardinality(p_record_ids),0);
 if v_count<1 or v_count>100
   or p_dataset is null
   or not exists(select 1 from public.v9_dataset_catalog where dataset=p_dataset)
   or exists(select 1 from unnest(p_record_ids) i where i is null or length(i) not between 1 and 200)
 then raise exception 'V9_BAD_PROBE';end if;
 return coalesce((
  select jsonb_agg(jsonb_build_object(
   'record_id',record_id,
   'delivery_revision',delivery_revision,
   'source_sha256',payload->'_v9'->>'source_sha256',
   'productivity_state',payload->'_v9'->>'productivity_state',
   'publication_status',payload->'_v9'->>'publication_status'
  ) order by record_id)
  from public.v9_operational_rows
  where dataset=p_dataset and record_id=any(p_record_ids)
 ),'[]'::jsonb);
end $function$
;
REVOKE ALL ON FUNCTION public.v9_ingest_probe_v1(text,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.v9_ingest_probe_v1(text,text[]) TO service_role;
