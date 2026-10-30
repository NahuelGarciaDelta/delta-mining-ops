-- Delta OPS V9: reubicar 34 vínculos sidecar tras inserción de cuatro filas en ROP05.
-- MIGRACIÓN DE IDENTIDAD, NO de productividad. El lector V8.1 queda intacto.
create table delta_v9.rop05_identity_relocations_v1(
 relocation_id bigint generated always as identity primary key,
 task_key text not null references delta_v9.rop05_identity_bridge_v1(task_key) on delete restrict,
 legacy_source_row_old integer not null,
 legacy_source_row_new integer not null,
 proof_sha256 text not null check(proof_sha256 ~ '^[a-f0-9]{64}$'),
 relocated_at timestamptz not null default now(),
 constraint no_same_row check(legacy_source_row_old<>legacy_source_row_new),
 unique(task_key,legacy_source_row_old,legacy_source_row_new)
);
alter table delta_v9.rop05_identity_relocations_v1 enable row level security;
revoke all on delta_v9.rop05_identity_relocations_v1 from public,anon,authenticated;
grant select on delta_v9.rop05_identity_relocations_v1 to service_role;
do $rebase$
declare n integer;
begin
 perform pg_advisory_xact_lock(hashtext('delta_external_sheet_sync|rop05'));
 perform pg_advisory_xact_lock(hashtext('delta_v9_rop05_bridge_load_20261030'));
 lock table delta_v9.rop05_identity_bridge_v1 in share row exclusive mode;
 -- Todas las filas nuevas se identifican por su payload original completo.
 create temporary table v9_verified_relocations on commit drop as
 select b.task_key,b.legacy_source_row as old_row,
        p.source_row as new_row,s.draft_sha256 as proof
 from delta_v9.rop05_identity_bridge_v1 b
 join delta_v9.rop05_shadow_revisions_v1 s on s.task_key=b.task_key and s.shadow_revision=1
 join public.rop05 p on p.source_dataset='rop05'
  and p.source_row=b.legacy_source_row+4
  and encode(sha256(convert_to(delta_v9.rop05_canonical_json_v1(p.raw_data),'UTF8')),'hex')=s.draft_sha256
 where b.legacy_source_row between 9692 and 9727
  and b.match_class='EXACT'
  and exists(
    select 1 from delta_v9.rop05_shadow_health_v1 h
    where h.task_key=b.task_key and h.shadow_status='IDENTITY_CHANGED_REVIEW');
 select count(*) into n from v9_verified_relocations;
 if n<>34 then raise exception 'REBASE_REJECTED_EXPECTED_34_ACTUAL_%',n;end if;
 if (select count(distinct task_key) from v9_verified_relocations)<>34
 or (select count(distinct new_row) from v9_verified_relocations)<>34
 or exists(
    select 1 from v9_verified_relocations r
    join delta_v9.rop05_identity_bridge_v1 b on b.legacy_source_row=r.new_row
    where not exists(
       select 1 from v9_verified_relocations x where x.task_key=b.task_key))
 or exists(select 1 from delta_v9.rop05_identity_bridge_v1 where legacy_source_row>=1000000)
 then raise exception 'REBASE_REJECTED_NONUNIQUE_OR_OCCUPIED_DESTINATION';end if;
 -- Aparcar evita violación temporal de UNIQUE(legacy_source_row) en un movimiento solapado.
 update delta_v9.rop05_identity_bridge_v1 b
 set legacy_source_row=b.legacy_source_row+1000000
 from v9_verified_relocations x where x.task_key=b.task_key and b.legacy_source_row=x.old_row;
 get diagnostics n=row_count;
 if n<>34 then raise exception 'REBASE_REJECTED_PARKED_%',n;end if;
 update delta_v9.rop05_identity_bridge_v1 b
 set legacy_source_row=x.new_row,verified_at=now()
 from v9_verified_relocations x
 where x.task_key=b.task_key and b.legacy_source_row=x.old_row+1000000;
 get diagnostics n=row_count;
 if n<>34 then raise exception 'REBASE_REJECTED_UPDATED_%',n;end if;
 insert into delta_v9.rop05_identity_relocations_v1
 (task_key,legacy_source_row_old,legacy_source_row_new,proof_sha256)
 select task_key,old_row,new_row,proof from v9_verified_relocations;
 get diagnostics n=row_count;
 if n<>34 then raise exception 'REBASE_REJECTED_AUDIT_%',n;end if;
 if exists(select 1 from delta_v9.rop05_shadow_health_v1 h
           join v9_verified_relocations x on x.task_key=h.task_key
           where h.shadow_status<>'UNCHANGED')
 then raise exception 'REBASE_POSTCHECK_FAILED';end if;
end $rebase$;
