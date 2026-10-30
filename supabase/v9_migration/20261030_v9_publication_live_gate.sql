-- DELTA OPS V9 - READ-ONLY live publication gate. Never sends a payload.
create view delta_v9.rop05_publication_live_gate_v1
with (security_invoker=true)
as
select
 b.task_key,
 b.dataset,
 b.legacy_source_row,
 b.productivity_state,
 pl.draft_revision as plan_draft_revision,
 pl.proposed_delivery_revision,
 pl.state as snapshot_plan_state,
 h.shadow_status as current_source_status,
 case
  when b.legacy_source_row is null then 'BLOCKED_UNLINKED'
  when h.shadow_status is distinct from 'UNCHANGED' then 'BLOCKED_SOURCE_DRIFT'
  when h.captured_sha256 is distinct from pl.draft_sha256 then 'BLOCKED_SNAPSHOT_STALE'
  else pl.state
 end as effective_publication_gate,
 false::boolean as can_publish,
 0::integer as actual_remote_ack_revision
from delta_v9.rop05_identity_bridge_v1 b
join delta_v9.rop05_publication_plan_v1 pl on pl.task_key=b.task_key
left join delta_v9.rop05_shadow_health_v1 h on h.task_key=b.task_key;
revoke all on delta_v9.rop05_publication_live_gate_v1 from public,anon,authenticated,service_role;
grant select on delta_v9.rop05_publication_live_gate_v1 to service_role;
