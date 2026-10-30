-- DELTA OPS V9 - Vista PRIVADA para detectar productividad modificada en ROP05.
-- Read-only, no triggers, no notifications, no publicaciones.
create view delta_v9.rop05_shadow_health_v1
with (security_invoker=true) as
select
 b.task_key,
 b.dataset,
 b.match_class,
 b.productivity_state,
 b.validation_status,
 b.legacy_source_row,
 s.shadow_revision as captured_revision,
 s.draft_sha256 as captured_sha256,
 c.live_sha256,
 c.live_identity_sha256,
 s.identity_sha256 as baseline_identity_sha256,
 s.captured_at as last_captured_at,
 case
  when b.legacy_source_row is null then 'QUARANTINE_UNLINKED'
  when p.source_row is null then 'LEGACY_ROW_MISSING'
  when s.task_key is null then 'BASELINE_NOT_CAPTURED'
  when c.live_identity_sha256 is distinct from first.identity_sha256 then 'IDENTITY_CHANGED_REVIEW'
  when c.live_sha256 is distinct from s.draft_sha256 then 'CONTENT_CHANGED_PENDING_CAPTURE'
  else 'UNCHANGED'
 end as shadow_status,
 case
  when b.productivity_state='WAITING_PRODUCTIVITY_NO_SEND' then 'BLOCKED_WAITING_PRODUCTIVITY'
  when b.match_class='SIN_CONTRAPARTE' then 'BLOCKED_UNLINKED'
  when b.validation_status='DB_TYPED_NUMERIC_ANOMALY' then 'BLOCKED_NUMERIC_ANOMALY'
  when b.match_class='REVISAR_PRODUCTIVIDAD' then 'BLOCKED_REVIEW'
  else 'PUBLICATION_NOT_ENABLED'
 end as publication_gate
from delta_v9.rop05_identity_bridge_v1 b
left join public.rop05 p
 on p.source_dataset='rop05' and p.source_row=b.legacy_source_row
left join lateral(
 select s1.task_key,s1.shadow_revision,s1.draft_sha256,s1.identity_sha256,s1.captured_at
 from delta_v9.rop05_shadow_revisions_v1 s1
 where s1.task_key=b.task_key
 order by s1.shadow_revision desc limit 1
) s on true
left join delta_v9.rop05_shadow_revisions_v1 first
 on first.task_key=b.task_key and first.shadow_revision=1
cross join lateral (
 select
 case when p.source_row is null then null
      else encode(sha256(convert_to(delta_v9.rop05_canonical_json_v1(p.raw_data),'UTF8')),'hex') end as live_sha256,
 case when p.source_row is null then null
      else delta_v9.rop05_identity_digest_v1(p.raw_data) end as live_identity_sha256
) c;
revoke all on delta_v9.rop05_shadow_health_v1 from public,anon,authenticated;
grant select on delta_v9.rop05_shadow_health_v1 to service_role;
