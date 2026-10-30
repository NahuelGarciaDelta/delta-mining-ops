-- DELTA OPS V9 - Historial sombra ROP05 en la base productiva.
-- No modifica public.rop05, no activa triggers ni envía/ACK datos operativos.
-- Operación autorizada: preservación de revisiones de las tareas del sidecar.
create or replace function delta_v9.rop05_canonical_json_v1(p_raw jsonb)
returns text language sql immutable set search_path = pg_catalog
as $fn$
 select array_to_json(array[
  coalesce(p_raw->>'Fecha del Parte Diario',''),
  coalesce(p_raw->>'Supervisor',''),
  coalesce(p_raw->>'Proyecto',''),
  coalesce(p_raw->>'Codigo Int',''),
  coalesce(p_raw->>'N° de Parte',''),
  coalesce(p_raw->>'Tipo Equipo',''),
  coalesce(p_raw->>'Tarea',''),
  coalesce(p_raw->>('CANTIDAD DE HS PRODUCTIVAS EFECTIVAS'||chr(10)||'(SOLO CANTIDAD)'),''),
  coalesce(p_raw->>'LARGO',''),
  coalesce(p_raw->>'ANCHO',''),
  coalesce(p_raw->>'PROFUNDIDAD',''),
  coalesce(p_raw->>('CANTIDAD DE PRODUCCIÓN DE LA TAREA REALIZADA'||chr(10)||'(SIN UNIDADES DE MEDIDA)'),''),
  coalesce(p_raw->>'UNIDAD DE PRODUCTIVIDAD',''),
  coalesce((select value from jsonb_each_text(p_raw) where key like 'OBSERVACION DE LA TAREA SEGUN LA SELECCIONADA%' limit 1),''),
  coalesce(p_raw->>'Mes','')
 ])::text;
$fn$;
create or replace function delta_v9.rop05_identity_digest_v1(p_raw jsonb)
returns text language sql immutable set search_path = pg_catalog
as $fn$
 select encode(sha256(convert_to(array_to_json(array[
  coalesce(p_raw->>'Fecha del Parte Diario',''),
  coalesce(p_raw->>'Proyecto',''),
  coalesce(p_raw->>'Codigo Int',''),
  coalesce(p_raw->>'N° de Parte',''),
  coalesce(p_raw->>'Tipo Equipo',''),
  coalesce(p_raw->>'Tarea','')
 ])::text, 'UTF8')),'hex');
$fn$;
create table delta_v9.rop05_shadow_revisions_v1 (
 task_key text not null references delta_v9.rop05_identity_bridge_v1(task_key) on delete restrict,
 shadow_revision integer not null check (shadow_revision>=1),
 legacy_source_row integer not null,
 draft_sha256 text not null check (draft_sha256 ~ '^[a-f0-9]{64}$'),
 identity_sha256 text not null check (identity_sha256 ~ '^[a-f0-9]{64}$'),
 canonical_json text not null,
 capture_reason text not null check (capture_reason in ('BASELINE','CONTENT_CHANGED')),
 captured_at timestamptz not null default now(),
 primary key(task_key,shadow_revision),
 constraint shadow_canonical_checksum check(
  encode(sha256(convert_to(canonical_json,'UTF8')),'hex') = draft_sha256),
 constraint shadow_valid_payload check(
  jsonb_typeof(canonical_json::jsonb)='array'
  and jsonb_array_length(canonical_json::jsonb)=15
 )
);
create index rop05_shadow_captured_at_idx on delta_v9.rop05_shadow_revisions_v1(captured_at);
alter table delta_v9.rop05_shadow_revisions_v1 enable row level security;
revoke all on delta_v9.rop05_shadow_revisions_v1 from public,anon,authenticated;
grant select on delta_v9.rop05_shadow_revisions_v1 to service_role;

create or replace function delta_v9.rop05_capture_shadow_v1(
 p_after_task_key text default '',
 p_limit integer default 300
) returns jsonb language plpgsql
set search_path=pg_catalog,delta_v9
as $fn$
declare
 b record;
 v_raw jsonb;
 v_current record;
 v_canonical text;
 v_digest text;
 v_identity text;
 v_base_identity text;
 v_has_previous boolean;
 v_processed int:=0;
 v_baselines int:=0;
 v_new_revisions int:=0;
 v_unchanged int:=0;
 v_quarantined int:=0;
 v_missing int:=0;
 v_baseline_mismatch int:=0;
 v_identity_drift int:=0;
 v_last_key text:=p_after_task_key;
begin
 if p_limit is null or p_limit<1 or p_limit>300
 or length(coalesce(p_after_task_key,''))>150 then
  raise exception 'INVALID_SHADOW_BATCH_PARAMETERS';
 end if;
 for b in
   select task_key,draft_revision,draft_sha256,legacy_source_row,match_class
   from delta_v9.rop05_identity_bridge_v1
   where task_key>coalesce(p_after_task_key,'')
   order by task_key
   limit p_limit
 loop
  v_processed:=v_processed+1;
  v_last_key:=b.task_key;
  if b.legacy_source_row is null then
    v_quarantined:=v_quarantined+1;continue;
  end if;
  select p.raw_data into v_raw
  from public.rop05 p
  where p.source_dataset='rop05' and p.source_row=b.legacy_source_row;
  if not found then
    v_missing:=v_missing+1;continue;
  end if;
  v_canonical:=delta_v9.rop05_canonical_json_v1(v_raw);
  v_digest:=encode(sha256(convert_to(v_canonical,'UTF8')),'hex');
  v_identity:=delta_v9.rop05_identity_digest_v1(v_raw);
  perform pg_advisory_xact_lock(hashtextextended('v9shadow:'||b.task_key,0));
  select shadow_revision,draft_sha256,identity_sha256 into v_current
  from delta_v9.rop05_shadow_revisions_v1
  where task_key=b.task_key order by shadow_revision desc limit 1;
  v_has_previous:=found;
  if not v_has_previous then
    -- Punto inicial exigido: identidad y contenido idénticos al snapshot V9 validado.
    if v_digest<>b.draft_sha256 then
      v_baseline_mismatch:=v_baseline_mismatch+1;continue;
    end if;
    insert into delta_v9.rop05_shadow_revisions_v1
     (task_key,shadow_revision,legacy_source_row,draft_sha256,identity_sha256,canonical_json,capture_reason)
    values(b.task_key,1,b.legacy_source_row,v_digest,v_identity,v_canonical,'BASELINE');
    v_baselines:=v_baselines+1;
  else
    select identity_sha256 into v_base_identity from delta_v9.rop05_shadow_revisions_v1
    where task_key=b.task_key and shadow_revision=1;
    if v_base_identity is distinct from v_identity then
      v_identity_drift:=v_identity_drift+1;continue;
    end if;
    if v_current.draft_sha256=v_digest then
      v_unchanged:=v_unchanged+1;continue;
    end if;
    insert into delta_v9.rop05_shadow_revisions_v1
     (task_key,shadow_revision,legacy_source_row,draft_sha256,identity_sha256,canonical_json,capture_reason)
    values(b.task_key,v_current.shadow_revision+1,b.legacy_source_row,v_digest,v_identity,v_canonical,'CONTENT_CHANGED');
    v_new_revisions:=v_new_revisions+1;
  end if;
 end loop;
 return jsonb_build_object(
  'mode','SHADOW_V9_NO_DELIVERY',
  'processed',v_processed,'baselineAdded',v_baselines,
  'newShadowRevisions',v_new_revisions,'unchanged',v_unchanged,
  'quarantineNoRow',v_quarantined,'missingLegacyRow',v_missing,
  'baselineHashMismatch',v_baseline_mismatch,'identityChangedHold',v_identity_drift,
  'lastTaskKey',v_last_key,'more',v_processed=p_limit,
  'outboundSends',0,'operationalAck',0,'legacyWrites',0);
end
$fn$;
-- Capture function is administrative: no web/API runtime role can execute.
revoke all on function delta_v9.rop05_canonical_json_v1(jsonb) from public,anon,authenticated,service_role;
revoke all on function delta_v9.rop05_identity_digest_v1(jsonb) from public,anon,authenticated,service_role;
revoke all on function delta_v9.rop05_capture_shadow_v1(text,integer) from public,anon,authenticated,service_role;
