-- DELTA OPS V9 - ADMIN-ONLY exact-payload reconciliation of shifted ROP05 rows.
-- No scheduled calls, no V8.1/ public.rop05 writes, no network, no publication.
create function delta_v9.rop05_rebase_exact_v1(
 p_search_min integer,
 p_search_max integer,
 p_expected integer
) returns jsonb
language plpgsql
set search_path=pg_catalog,delta_v9
as $fn$
declare
 n integer;
 v_candidates integer;
 v_min_old integer;
 v_max_old integer;
 v_min_new integer;
 v_max_new integer;
begin
 if p_search_min is null or p_search_max is null or p_search_min<4431
    or p_search_max<=p_search_min or p_search_max-p_search_min>1000
    or p_expected is null or p_expected<1 or p_expected>100
 then
  raise exception 'V9_REBASE_BAD_PARAMETERS';
 end if;
 perform pg_advisory_xact_lock(hashtext('delta_external_sheet_sync|rop05'));
 perform pg_advisory_xact_lock(hashtext('delta_v9_rop05_bridge_load_20261030'));
 lock table delta_v9.rop05_identity_bridge_v1 in share row exclusive mode;
 create temporary table v9_current_exact_rebase on commit drop as
 select b.task_key,b.legacy_source_row old_row,p.source_row new_row,s.draft_sha256 proof
 from delta_v9.rop05_identity_bridge_v1 b
 join delta_v9.rop05_shadow_health_v1 h on h.task_key=b.task_key
 join delta_v9.rop05_shadow_revisions_v1 s
   on s.task_key=b.task_key and s.shadow_revision=1
 join public.rop05 p on p.source_dataset='rop05'
   and p.source_row between p_search_min and p_search_max
   and encode(sha256(convert_to(delta_v9.rop05_canonical_json_v1(p.raw_data),'UTF8')),'hex')=s.draft_sha256
 where h.shadow_status='IDENTITY_CHANGED_REVIEW'
   and b.legacy_source_row between p_search_min and p_search_max
   and b.match_class='EXACT'
   and p.source_row<>b.legacy_source_row;
 select count(*),min(old_row),max(old_row),min(new_row),max(new_row)
 into v_candidates,v_min_old,v_max_old,v_min_new,v_max_new from v9_current_exact_rebase;
 select count(*) into n
 from delta_v9.rop05_shadow_health_v1 h
 join delta_v9.rop05_identity_bridge_v1 b using(task_key)
 where h.shadow_status='IDENTITY_CHANGED_REVIEW'
 and b.legacy_source_row between p_search_min and p_search_max;
 if n<>p_expected or v_candidates<>p_expected
 or (select count(distinct task_key) from v9_current_exact_rebase)<>p_expected
 or (select count(distinct new_row) from v9_current_exact_rebase)<>p_expected
 then
  raise exception 'V9_REBASE_PROOF_FAILED drift=% candidates=% expected=%',n,v_candidates,p_expected;
 end if;
 if exists (
  select 1 from v9_current_exact_rebase r
  join delta_v9.rop05_identity_bridge_v1 b on b.legacy_source_row=r.new_row
  where not exists(select 1 from v9_current_exact_rebase x where x.task_key=b.task_key)
 ) then raise exception 'V9_REBASE_TARGET_OWNED_BY_OTHER_TASK';end if;
 if exists(select 1 from delta_v9.rop05_identity_bridge_v1 where legacy_source_row>=100000000)
 then raise exception 'V9_REBASE_PARKING_RANGE_NOT_FREE';end if;
 update delta_v9.rop05_identity_bridge_v1 b
 set legacy_source_row=b.legacy_source_row+100000000
 from v9_current_exact_rebase r where r.task_key=b.task_key and b.legacy_source_row=r.old_row;
 get diagnostics n=row_count;
 if n<>p_expected then raise exception 'V9_REBASE_PARK_FAIL_%',n;end if;
 update delta_v9.rop05_identity_bridge_v1 b
 set legacy_source_row=r.new_row,verified_at=now()
 from v9_current_exact_rebase r
 where r.task_key=b.task_key and b.legacy_source_row=r.old_row+100000000;
 get diagnostics n=row_count;
 if n<>p_expected then raise exception 'V9_REBASE_FINAL_FAIL_%',n;end if;
 insert into delta_v9.rop05_identity_relocations_v1
 (task_key,legacy_source_row_old,legacy_source_row_new,proof_sha256)
 select task_key,old_row,new_row,proof from v9_current_exact_rebase;
 get diagnostics n=row_count;
 if n<>p_expected then raise exception 'V9_REBASE_AUDIT_FAIL_%',n;end if;
 if exists(select 1 from v9_current_exact_rebase r
 join delta_v9.rop05_shadow_health_v1 h using(task_key)
 where h.shadow_status<>'UNCHANGED')
 then raise exception 'V9_REBASE_POSTCHECK_FAILED';end if;
 return jsonb_build_object('ok',true,'relinked',p_expected,
  'oldRowMin',v_min_old,'oldRowMax',v_max_old,
  'newRowMin',v_min_new,'newRowMax',v_max_new,
  'legacyWrites',0,'publicationWrites',0,'ackWrites',0);
end
$fn$;
revoke all on function delta_v9.rop05_rebase_exact_v1(integer,integer,integer)
from PUBLIC,anon,authenticated,service_role;
