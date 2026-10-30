-- DELTA OPS V9 - PRE-PUBLICATION PLAN. NO OPERATIVE DELIVERY.
-- Private sidecar only. public.rop05 and V8.1 remain untouched.
create table delta_v9.rop05_publication_plan_v1 (
 task_key text primary key references delta_v9.rop05_identity_bridge_v1(task_key) on delete restrict,
 dataset text not null check(dataset in ('rop02_jm','rop02_fs')),
 shadow_revision integer,
 draft_revision integer not null check(draft_revision>=1),
 proposed_delivery_revision integer not null default 1 check(proposed_delivery_revision=1),
 draft_sha256 text not null check(draft_sha256 ~ '^[a-f0-9]{64}$'),
 source_outbox_row integer not null unique,
 state text not null check(state in ('BLOCKED_UNLINKED','BLOCKED_PRODUCTIVITY_PENDING','BLOCKED_NUMERIC_ANOMALY','BLOCKED_LEGACY_REVIEW','BLOCKED_SOURCE_CHANGED','BLOCKED_CLOSURE_UNCONFIRMED')),
 delivery_request_id uuid check(delivery_request_id is null),
 last_delivery_ack_revision integer not null default 0 check(last_delivery_ack_revision=0),
 delivery_enabled boolean not null default false check(delivery_enabled=false),
 remote_ack_at timestamptz check(remote_ack_at is null),
 created_at timestamptz not null default now(),
 constraint pub_plan_shadow_fk foreign key(task_key,shadow_revision)
  references delta_v9.rop05_shadow_revisions_v1(task_key,shadow_revision) on delete restrict,
 constraint pub_plan_only_unlinked_no_shadow check(
  (state='BLOCKED_UNLINKED' and shadow_revision is null)
  or (state<>'BLOCKED_UNLINKED' and shadow_revision is not null))
);
create index rop05_publication_plan_state_idx on delta_v9.rop05_publication_plan_v1(state);
alter table delta_v9.rop05_publication_plan_v1 enable row level security;
revoke all on delta_v9.rop05_publication_plan_v1 from public,anon,authenticated,service_role;
grant select on delta_v9.rop05_publication_plan_v1 to service_role;

create table delta_v9.rop05_delivery_receipts_v1 (
 request_id uuid primary key,
 task_key text not null references delta_v9.rop05_identity_bridge_v1(task_key) on delete restrict,
 delivery_revision integer not null check(delivery_revision>=1),
 payload_sha256 text not null check(payload_sha256 ~ '^[a-f0-9]{64}$'),
 receiver_proof jsonb not null,
 verified_at timestamptz not null default now(),
 constraint unique_task_delivery_rev unique(task_key,delivery_revision)
);
alter table delta_v9.rop05_delivery_receipts_v1 enable row level security;
revoke all on delta_v9.rop05_delivery_receipts_v1 from public,anon,authenticated,service_role;
grant select on delta_v9.rop05_delivery_receipts_v1 to service_role;

do $safe$
declare n integer;
begin
 perform pg_advisory_xact_lock(hashtext('delta_v9_rop05_bridge_load_20261030'));
 insert into delta_v9.rop05_publication_plan_v1
  (task_key,dataset,shadow_revision,draft_revision,draft_sha256,source_outbox_row,state)
 select b.task_key,b.dataset,s.shadow_revision,b.draft_revision,b.draft_sha256,b.source_outbox_row,
 case
  when b.legacy_source_row is null then 'BLOCKED_UNLINKED'
  when s.shadow_revision is null or h.shadow_status<>'UNCHANGED' or s.draft_sha256<>b.draft_sha256 then 'BLOCKED_SOURCE_CHANGED'
  when b.productivity_state='WAITING_PRODUCTIVITY_NO_SEND' then 'BLOCKED_PRODUCTIVITY_PENDING'
  when b.validation_status='DB_TYPED_NUMERIC_ANOMALY' then 'BLOCKED_NUMERIC_ANOMALY'
  when b.match_class='REVISAR_PRODUCTIVIDAD' then 'BLOCKED_LEGACY_REVIEW'
  else 'BLOCKED_CLOSURE_UNCONFIRMED'
 end
 from delta_v9.rop05_identity_bridge_v1 b
 left join lateral(
  select s1.shadow_revision,s1.draft_sha256 from delta_v9.rop05_shadow_revisions_v1 s1
  where s1.task_key=b.task_key order by s1.shadow_revision desc limit 1
 ) s on true
 left join delta_v9.rop05_shadow_health_v1 h on h.task_key=b.task_key;
 get diagnostics n=row_count;
 if n<>5295 then raise exception 'V9_PLAN_ROW_COUNT_MISMATCH_%',n;end if;
 if exists(select 1 from delta_v9.rop05_publication_plan_v1
           where delivery_enabled or last_delivery_ack_revision<>0 or delivery_request_id is not null or remote_ack_at is not null)
 then raise exception 'V9_PLAN_NOT_LOCKED';end if;
 if (select count(*) from delta_v9.rop05_delivery_receipts_v1)<>0 then raise exception 'V9_RECEIPTS_NOT_EMPTY';end if;
end $safe$;
