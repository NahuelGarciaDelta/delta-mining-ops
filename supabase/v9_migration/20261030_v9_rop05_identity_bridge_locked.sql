-- Delta Mining V9 - MIGRACIÓN AUTORIZADA: índice de identidad ROP05, SOLO SIDECAR.
-- No modifica public.rop05, no triggers, no envíos, nunca publicable en esta versión.
create schema delta_v9;
revoke all on schema delta_v9 from public, anon, authenticated;
create table delta_v9.rop05_identity_bridge_v1 (
 task_key text primary key,
 dataset text not null check (dataset in ('rop02_jm','rop02_fs')),
 legacy_source_row integer unique,
 legacy_source_dataset text not null default 'rop05' check (legacy_source_dataset='rop05'),
 match_class text not null check (match_class in ('EXACT','REVISAR_PRODUCTIVIDAD','SIN_CONTRAPARTE')),
 validation_status text not null check (validation_status in ('DB_MATCH_15_FIELDS','DB_TYPED_NUMERIC_ANOMALY','QUARANTINE_NO_LEGACY_ID')),
 draft_sha256 text not null check (draft_sha256 ~ '^[a-f0-9]{64}$'),
 draft_revision integer not null check (draft_revision>=1),
 productivity_state text not null check (productivity_state in ('PREPARED_NO_SEND','WAITING_PRODUCTIVITY_NO_SEND','HISTORY_GAP_NO_SEND')),
 source_outbox_row integer not null unique check (source_outbox_row>=2),
 review_fields text not null default '',
 snapshot_date date not null default date '2026-10-30',
 verified_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 publishing_enabled boolean not null default false check (publishing_enabled=false),
 last_remote_ack_revision integer not null default 0 check (last_remote_ack_revision=0),
 last_remote_ack_sha256 text check (last_remote_ack_sha256 is null),
 constraint task_key_exact_format check (task_key ~ ('^'||dataset||':[A-Za-z0-9_-]{4,90}:t[123]$')),
 constraint classification_guard check (
  (match_class='EXACT' and validation_status='DB_MATCH_15_FIELDS' and legacy_source_row is not null)
  or (match_class='REVISAR_PRODUCTIVIDAD' and validation_status in ('DB_MATCH_15_FIELDS','DB_TYPED_NUMERIC_ANOMALY') and legacy_source_row is not null)
  or (match_class='SIN_CONTRAPARTE' and validation_status='QUARANTINE_NO_LEGACY_ID' and legacy_source_row is null)
 )
);
create index rop05_identity_bridge_status_idx on delta_v9.rop05_identity_bridge_v1(match_class,validation_status);
alter table delta_v9.rop05_identity_bridge_v1 enable row level security;
revoke all on delta_v9.rop05_identity_bridge_v1 from public,anon,authenticated;
grant usage on schema delta_v9 to service_role;
grant select on delta_v9.rop05_identity_bridge_v1 to service_role;
-- No write grants to clients, no public RPC, and even DB owners cannot flip publishing_enabled without an explicit new DDL migration.
