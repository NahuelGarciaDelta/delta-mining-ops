-- V9 INDEPENDENT ONLY, Supabase project biztlietuvvonigcfdwy.
-- No triggers, no interaction with V8.1 or original ROP05.
alter table public.v9_operational_rows add column delivery_revision integer not null default 1
 check (delivery_revision>=1);
alter table public.v9_operational_rows add column payload_sha256 text not null default repeat('0',64)
 check (payload_sha256 ~ '^[0-9a-f]{64}$');
create table public.v9_ingest_versions(
 dataset text not null,
 record_id text not null,
 delivery_revision integer not null check(delivery_revision>=1),
 payload_sha256 text not null check(payload_sha256 ~ '^[0-9a-f]{64}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 received_at timestamptz not null default now(),
 primary key(dataset,record_id,delivery_revision),
 foreign key(dataset,record_id) references public.v9_operational_rows(dataset,record_id) deferrable initially deferred
);
create table public.v9_ingest_receipts(
 request_id uuid primary key,
 dataset text not null references public.v9_dataset_catalog(dataset),
 batch_sha256 text not null check(batch_sha256 ~ '^[0-9a-f]{64}$'),
 result jsonb not null,
 received_at timestamptz not null default now()
);
alter table public.v9_ingest_versions enable row level security;
alter table public.v9_ingest_receipts enable row level security;
revoke all on public.v9_ingest_versions from public,anon,authenticated;
revoke all on public.v9_ingest_receipts from public,anon,authenticated;
-- Service role is used only by Apps Script V9 server-side. Never from browser.
create function public.v9_ingest_accept_batch_v1(
 p_request_id uuid,p_dataset text,p_records jsonb
) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public
as $fn$
declare
 v_current record;
 v_existing record;
 v_row jsonb;
 v_id text;
 v_payload jsonb;
 v_revision integer;
 v_sha text;
 v_history_sha text;
 v_existing_history boolean;
 v_current_found boolean;
 v_batch_sha text;
 v_created integer:=0;
 v_updated integer:=0;
 v_duplicates integer:=0;
 v_result jsonb;
begin
 if p_request_id is null or p_dataset is null
  or p_records is null or jsonb_typeof(p_records)<>'array'
  or jsonb_array_length(p_records) not between 1 and 100
  or length(p_records::text)>600000
 then raise exception 'V9_INVALID_BATCH';end if;
 if not exists(select 1 from public.v9_dataset_catalog where dataset=p_dataset and read_enabled)
 then raise exception 'V9_UNKNOWN_DATASET';end if;
 -- Serialize updates for one dataset. Cross-dataset UUID uniqueness still enforced.
 perform pg_advisory_xact_lock(hashtextextended('v9-batch:'||p_dataset,0));
 v_batch_sha:=encode(sha256(convert_to(p_dataset||':'||p_records::text,'UTF8')),'hex');
 select dataset,batch_sha256,result into v_existing
 from public.v9_ingest_receipts where request_id=p_request_id;
 if found then
  if v_existing.dataset<>p_dataset or v_existing.batch_sha256<>v_batch_sha
  then raise exception 'V9_REQUEST_ID_REUSED_DIFFERENT_PAYLOAD';end if;
  return v_existing.result||jsonb_build_object('replay',true);
 end if;
 if exists(select 1 from jsonb_array_elements(p_records) x(v)
           group by x.v->>'record_id' having count(*)>1)
 then raise exception 'V9_DUPLICATE_RECORD_ID_IN_BATCH';end if;
 for v_row in select value from jsonb_array_elements(p_records) loop
  if jsonb_typeof(v_row)<>'object'
  or jsonb_typeof(v_row->'payload')<>'object'
  or length(v_row->'payload'::text)>100000
  or jsonb_typeof(v_row->'delivery_revision')<>'number'
  then raise exception 'V9_INVALID_RECORD';end if;
  v_id:=v_row->>'record_id';
  v_revision:=(v_row->>'delivery_revision')::integer;
  v_payload:=v_row->'payload';
  if v_id is null or length(v_id) not between 1 and 200 or v_revision<1
  then raise exception 'V9_INVALID_ID_OR_REVISION';end if;
  v_sha:=encode(sha256(convert_to(v_payload::text,'UTF8')),'hex');
  select delivery_revision,payload_sha256 into v_current
  from public.v9_operational_rows where dataset=p_dataset and record_id=v_id;
  v_current_found:=found;
  if not v_current_found then
   if v_revision<>1 then raise exception 'V9_FIRST_DELIVERY_MUST_BE_REVISION_ONE';end if;
   insert into public.v9_operational_rows(dataset,record_id,payload,delivery_revision,payload_sha256)
   values(p_dataset,v_id,v_payload,v_revision,v_sha);
   insert into public.v9_ingest_versions(dataset,record_id,delivery_revision,payload_sha256,payload)
   values(p_dataset,v_id,v_revision,v_sha,v_payload);
   v_created:=v_created+1;
  elsif v_revision>v_current.delivery_revision then
   if v_revision<>v_current.delivery_revision+1
   then raise exception 'V9_REVISION_GAP';end if;
   insert into public.v9_ingest_versions(dataset,record_id,delivery_revision,payload_sha256,payload)
   values(p_dataset,v_id,v_revision,v_sha,v_payload);
   update public.v9_operational_rows
   set delivery_revision=v_revision,payload=v_payload,payload_sha256=v_sha,updated_at=now()
   where dataset=p_dataset and record_id=v_id and delivery_revision=v_current.delivery_revision;
   if not found then raise exception 'V9_CONCURRENT_REVISION';end if;
   v_updated:=v_updated+1;
  else
   select payload_sha256 into v_history_sha
   from public.v9_ingest_versions
   where dataset=p_dataset and record_id=v_id and delivery_revision=v_revision;
   v_existing_history:=found;
   if not v_existing_history or v_history_sha<>v_sha
   then raise exception 'V9_REVISION_CONFLICT';end if;
   v_duplicates:=v_duplicates+1;
  end if;
 end loop;
 v_result:=jsonb_build_object('ok',true,'dataset',p_dataset,'request_id',p_request_id,
  'created',v_created,'updated',v_updated,'alreadyDelivered',v_duplicates,
  'batch_sha256',v_batch_sha,'replay',false,'mode','V9_INDEPENDENT_ONLY');
 insert into public.v9_ingest_receipts(request_id,dataset,batch_sha256,result)
 values(p_request_id,p_dataset,v_batch_sha,v_result);
 return v_result;
end $fn$;
revoke all on function public.v9_ingest_accept_batch_v1(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.v9_ingest_accept_batch_v1(uuid,text,jsonb) to service_role;
