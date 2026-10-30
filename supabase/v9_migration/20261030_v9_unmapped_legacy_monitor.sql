-- DELTA OPS V9 - live private quarantine of legacy ROP05 rows not yet linked.
-- No DB writes, no triggers and no V8.1 changes.
create view delta_v9.rop05_unmapped_legacy_v1 with (security_invoker=true) as
select
 p.source_dataset,
 p.source_row,
 p.fecha,
 p.proyecto,
 p.interno,
 p.numero_parte,
 p.tarea,
 encode(sha256(convert_to(delta_v9.rop05_canonical_json_v1(p.raw_data),'UTF8')),'hex') as raw_sha256,
 'UNMAPPED_NEEDS_IDENTITY_RECONCILIATION'::text as state,
 p.synced_at
from public.rop05 p
where p.source_dataset='rop05'
  and p.source_row>=4431
  and not exists(
   select 1 from delta_v9.rop05_identity_bridge_v1 b
   where b.legacy_source_row=p.source_row
  );
revoke all on delta_v9.rop05_unmapped_legacy_v1 from public,anon,authenticated,service_role;
grant select on delta_v9.rop05_unmapped_legacy_v1 to service_role;
-- Helper function for view is read-only, private schema not exposed as Data API.
grant execute on function delta_v9.rop05_canonical_json_v1(jsonb) to service_role;
