-- CANDIDATO DE MIGRACIÓN. NO APLICAR A SUPABASE PRODUCTIVO SIN APROBACIÓN.
-- Tabla sidecar: conserva las filas ROP05 heredadas, no modifica public.rop05.
-- Se llena a partir del puente ya conciliado en Google Sheets, una vez
-- completadas autorización, backup y revalidación de snapshot.
create schema if not exists delta_v9;
create table if not exists delta_v9.rop05_identity_bridge_v1 (
  task_key text primary key,
  dataset text not null check(dataset in ('rop02_jm','rop02_fs')),
  legacy_source_row integer unique,
  legacy_source_dataset text not null default 'rop05' check(legacy_source_dataset='rop05'),
  match_class text not null check(match_class in
    ('EXACT','REVISAR_PRODUCTIVIDAD','SIN_CONTRAPARTE')),
  validation_status text not null check(validation_status in
    ('DB_MATCH_15_FIELDS','DB_TYPED_NUMERIC_ANOMALY',
     'QUARANTINE_NO_LEGACY_ID','DB_DRIFT_QUARANTINE','DB_SOURCE_ROW_NOT_FOUND')),
  draft_sha256 text not null check(draft_sha256 ~ '^[a-f0-9]{64}$'),
  draft_revision integer not null check(draft_revision >= 1),
  publishing_enabled boolean not null default false,
  last_remote_ack_revision integer not null default 0 check(last_remote_ack_revision>=0),
  last_remote_ack_sha256 text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint bridge_task_key_consistent check (task_key like dataset || ':%:t_'),
  constraint bridge_null_for_unlinked check(
    (match_class='SIN_CONTRAPARTE' and legacy_source_row is null)
    or (match_class<>'SIN_CONTRAPARTE' and legacy_source_row is not null)),
  constraint bridge_no_unapproved_publication check(
    publishing_enabled=false or (match_class='EXACT' and validation_status='DB_MATCH_15_FIELDS')),
  constraint ack_digest_pair check(
    (last_remote_ack_revision=0 and last_remote_ack_sha256 is null)
    or (last_remote_ack_revision>0 and last_remote_ack_sha256 ~ '^[a-f0-9]{64}$'))
);
alter table delta_v9.rop05_identity_bridge_v1 enable row level security;
revoke all on schema delta_v9 from public,anon,authenticated;
revoke all on delta_v9.rop05_identity_bridge_v1 from public,anon,authenticated;
-- Service role granted only for authorized server integration. Do NOT expose key in frontend.
grant usage on schema delta_v9 to service_role;
grant select,insert,update on delta_v9.rop05_identity_bridge_v1 to service_role;
-- Future loader MUST refuse insert if task_key or legacy_source_row already mapped
-- to a different partner. No DELETE or ON CONFLICT REPLACE allowed.
-- Legacy Supabase public.rop05 remains unchanged.
