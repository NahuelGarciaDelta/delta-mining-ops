-- Registro autoritativo de fuentes ROP02. Ningún dato operativo existente se modifica.
create table if not exists public.rop02_project_sources(
 dataset text primary key check(dataset ~ '^rop02_[a-z0-9_]+$'),
 project text not null,
 spreadsheet_id text not null,
 sheet_gid integer not null,
 sheet_name text not null,
 header_row integer not null default 4 check(header_row between 1 and 100),
 enabled boolean not null default true,
 created_at timestamptz not null default now(),
 unique(spreadsheet_id,sheet_gid)
);
alter table public.rop02_project_sources enable row level security;
revoke all on table public.rop02_project_sources from public,anon,authenticated;
grant select,insert,update on public.rop02_project_sources to service_role;
insert into public.rop02_project_sources(dataset,project,spreadsheet_id,sheet_gid,sheet_name,header_row,enabled)
values
('rop02_fs','FILO DEL SOL','1dt5THoDndDM9pBZYkNR0gjkPrSrunnkMA8DgqQZB2OU',396764804,'R_OP02_FS',4,true),
('rop02_jm','JOSE MARIA','1RzOwDSmd1fw48hvPCfoauPnZGE44G9NgSazMdjVxj4Q',967767400,'R_OP02_JM',4,true),
('rop02_filosur','FILO SUR','1RpKLXTQNxlqoRy9c5FXI23ZV-OatlsRCvu4CuNWBt0w',1301566995,'R_OP2_',4,true),
('rop02_zorro','EL ZORRO','1HUSJBcMgOkSnMxul5QHWruIS3Jwx2Oyenf6VFWma4YI',967767400,'R_OP02_EL_ZORRO',4,true),
('rop02_fierro','EL FIERRO','1Ud7GerplVfoV5YpVxhipg2hDZ-JTjBTyCux66R2caL0',967767400,'R_OP02_EL_FIERRO',4,true)
on conflict(dataset) do nothing;
create or replace function private.rop02_source_enabled(p_dataset text)
returns boolean language sql stable security definer set search_path = ''
as $fn$ select exists(select 1 from public.rop02_project_sources s where s.dataset=p_dataset and s.enabled) $fn$;
revoke all on function private.rop02_source_enabled(text) from public,anon,authenticated;
grant execute on function private.rop02_source_enabled(text) to service_role;

-- private.begin_rop02_manual_sync
CREATE OR REPLACE FUNCTION private.begin_rop02_manual_sync(p_dataset text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.rop02_source_enabled(p_dataset) then
    raise exception 'Dataset ROP02 no permitido: %',p_dataset;
  end if;
  delete from private.rop02_manual_stage where source_dataset=p_dataset;
  insert into private.rop02_manual_sync_state(source_dataset,started_at)
  values(p_dataset,now())
  on conflict(source_dataset) do update set started_at=excluded.started_at;
  return jsonb_build_object('ok',true,'dataset',p_dataset,'startedAt',now());
end
$function$;

-- private.finalize_rop02_manual_sync
CREATE OR REPLACE FUNCTION private.finalize_rop02_manual_sync(p_dataset text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_upserted integer:=0;
  v_deleted integer:=0;
begin
  if not private.rop02_source_enabled(p_dataset) then
    raise exception 'Dataset ROP02 no permitido: %',p_dataset;
  end if;
  if not exists(select 1 from private.rop02_manual_sync_state where source_dataset=p_dataset) then
    raise exception 'No hay sincronización ROP02 iniciada para %',p_dataset;
  end if;

  insert into public.rop02(source_dataset,source_row,fecha,interno,equipo,operador,supervisor_delta,supervisor_vial_cliente,
    turno_trabajo,numero_parte,proyecto,horometro_inicial,horometro_final,cantidad_horas,combustible,aceite,aceite_text,
    descripcion_trabajos,informacion_desgaste,observaciones,source_key,synced_at,updated_at)
  select source_dataset,source_row,fecha,interno,equipo,operador,supervisor_delta,supervisor_vial_cliente,
    turno_trabajo,numero_parte,proyecto,horometro_inicial,horometro_final,cantidad_horas,combustible,aceite,aceite_text,
    descripcion_trabajos,informacion_desgaste,observaciones,'SRC|'||upper(source_dataset)||'|'||source_row::text,now(),now()
  from private.rop02_manual_stage where source_dataset=p_dataset
  on conflict(source_dataset,source_row) do update set
    fecha=excluded.fecha,interno=excluded.interno,equipo=excluded.equipo,operador=excluded.operador,
    supervisor_delta=excluded.supervisor_delta,supervisor_vial_cliente=excluded.supervisor_vial_cliente,
    turno_trabajo=excluded.turno_trabajo,numero_parte=excluded.numero_parte,proyecto=excluded.proyecto,
    horometro_inicial=excluded.horometro_inicial,horometro_final=excluded.horometro_final,
    cantidad_horas=excluded.cantidad_horas,combustible=excluded.combustible,aceite=excluded.aceite,
    aceite_text=excluded.aceite_text,descripcion_trabajos=excluded.descripcion_trabajos,
    informacion_desgaste=excluded.informacion_desgaste,observaciones=excluded.observaciones,
    source_key=excluded.source_key,synced_at=now(),updated_at=now();
  get diagnostics v_upserted=row_count;

  delete from public.rop02 r
  where r.source_dataset=p_dataset and r.source_row is not null
    and not exists(
      select 1 from private.rop02_manual_stage s
      where s.source_dataset=p_dataset and s.source_row=r.source_row
    );
  get diagnostics v_deleted=row_count;

  delete from private.rop02_manual_sync_state where source_dataset=p_dataset;

  return jsonb_build_object(
    'ok',true,'dataset',p_dataset,'upserted',v_upserted,'deleted',v_deleted,
    'total',(select count(*) from public.rop02 where source_dataset=p_dataset and source_row is not null),
    'syncedAt',now()
  );
end
$function$;

-- public.apply_rop02_external_delta_v2
CREATE OR REPLACE FUNCTION public.apply_rop02_external_delta_v2(p_dataset text, p_upserts jsonb DEFAULT '[]'::jsonb, p_delete_source_rows jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_upsert_input integer := 0;
  v_delete_input integer := 0;
  v_upserted integer := 0;
  v_deleted integer := 0;
begin
  if not private.rop02_source_enabled(p_dataset) then
    raise exception 'Dataset ROP02 incremental no permitido: %', p_dataset;
  end if;

  if jsonb_typeof(coalesce(p_upserts,'[]'::jsonb)) <> 'array' then
    raise exception 'p_upserts debe ser array';
  end if;
  if jsonb_typeof(coalesce(p_delete_source_rows,'[]'::jsonb)) <> 'array' then
    raise exception 'p_delete_source_rows debe ser array';
  end if;

  v_upsert_input := jsonb_array_length(coalesce(p_upserts,'[]'::jsonb));
  v_delete_input := jsonb_array_length(coalesce(p_delete_source_rows,'[]'::jsonb));

  if v_upsert_input > 10000 or v_delete_input > 10000 then
    raise exception 'Delta ROP02 demasiado grande: upserts %, deletes %', v_upsert_input, v_delete_input;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_upserts,'[]'::jsonb)) x
    where coalesce(x->>'source_row','') !~ '^[1-9][0-9]*$'
       or coalesce(x->>'fecha','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       or btrim(coalesce(x->>'interno','')) = ''
  ) then
    raise exception 'Delta ROP02 contiene upserts inválidos';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_upserts,'[]'::jsonb)) x
    group by (x->>'source_row')::integer
    having count(*) > 1
  ) then
    raise exception 'Delta ROP02 contiene source_row duplicado en upserts';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(coalesce(p_delete_source_rows,'[]'::jsonb)) d(value)
    where d.value !~ '^[1-9][0-9]*$'
  ) then
    raise exception 'Delta ROP02 contiene source_row inválido en deletes';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(coalesce(p_delete_source_rows,'[]'::jsonb)) d(value)
    group by d.value
    having count(*) > 1
  ) then
    raise exception 'Delta ROP02 contiene source_row duplicado en deletes';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_upserts,'[]'::jsonb)) u
    join jsonb_array_elements_text(coalesce(p_delete_source_rows,'[]'::jsonb)) d(value)
      on d.value::integer = (u->>'source_row')::integer
  ) then
    raise exception 'Un source_row no puede estar en upserts y deletes al mismo tiempo';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('delta_external_sheet_sync|' || p_dataset));

  if v_upsert_input > 0 then
    insert into public.rop02(
      source_dataset, source_row, fecha, interno, equipo, operador,
      supervisor_delta, supervisor_vial_cliente, turno_trabajo, numero_parte,
      proyecto, horometro_inicial, horometro_final, cantidad_horas, combustible,
      aceite, aceite_text, descripcion_trabajos, informacion_desgaste,
      observaciones, source_key, synced_at, updated_at
    )
    select
      p_dataset,
      (x->>'source_row')::integer,
      (x->>'fecha')::date,
      btrim(coalesce(x->>'interno','')),
      btrim(coalesce(x->>'equipo','')),
      btrim(coalesce(x->>'operador','')),
      btrim(coalesce(x->>'supervisor_delta','')),
      btrim(coalesce(x->>'supervisor_vial_cliente','')),
      btrim(coalesce(x->>'turno_trabajo','')),
      btrim(coalesce(x->>'numero_parte','')),
      btrim(coalesce(x->>'proyecto','')),
      nullif(x->>'horometro_inicial','')::numeric,
      nullif(x->>'horometro_final','')::numeric,
      nullif(x->>'cantidad_horas','')::numeric,
      nullif(x->>'combustible','')::numeric,
      nullif(x->>'aceite_num','')::numeric,
      btrim(coalesce(x->>'aceite','')),
      btrim(coalesce(x->>'descripcion_trabajos','')),
      btrim(coalesce(x->>'informacion_desgaste','')),
      btrim(coalesce(x->>'observaciones','')),
      'SRC|' || upper(p_dataset) || '|' || (x->>'source_row'),
      now(),
      now()
    from jsonb_array_elements(coalesce(p_upserts,'[]'::jsonb)) x
    on conflict(source_dataset, source_row) do update set
      fecha = excluded.fecha,
      interno = excluded.interno,
      equipo = excluded.equipo,
      operador = excluded.operador,
      supervisor_delta = excluded.supervisor_delta,
      supervisor_vial_cliente = excluded.supervisor_vial_cliente,
      turno_trabajo = excluded.turno_trabajo,
      numero_parte = excluded.numero_parte,
      proyecto = excluded.proyecto,
      horometro_inicial = excluded.horometro_inicial,
      horometro_final = excluded.horometro_final,
      cantidad_horas = excluded.cantidad_horas,
      combustible = excluded.combustible,
      aceite = excluded.aceite,
      aceite_text = excluded.aceite_text,
      descripcion_trabajos = excluded.descripcion_trabajos,
      informacion_desgaste = excluded.informacion_desgaste,
      observaciones = excluded.observaciones,
      source_key = excluded.source_key,
      synced_at = now(),
      updated_at = now()
    where row(
      public.rop02.fecha, public.rop02.interno, public.rop02.equipo, public.rop02.operador,
      public.rop02.supervisor_delta, public.rop02.supervisor_vial_cliente,
      public.rop02.turno_trabajo, public.rop02.numero_parte, public.rop02.proyecto,
      public.rop02.horometro_inicial, public.rop02.horometro_final,
      public.rop02.cantidad_horas, public.rop02.combustible, public.rop02.aceite,
      public.rop02.aceite_text, public.rop02.descripcion_trabajos,
      public.rop02.informacion_desgaste, public.rop02.observaciones, public.rop02.source_key
    ) is distinct from row(
      excluded.fecha, excluded.interno, excluded.equipo, excluded.operador,
      excluded.supervisor_delta, excluded.supervisor_vial_cliente,
      excluded.turno_trabajo, excluded.numero_parte, excluded.proyecto,
      excluded.horometro_inicial, excluded.horometro_final,
      excluded.cantidad_horas, excluded.combustible, excluded.aceite,
      excluded.aceite_text, excluded.descripcion_trabajos,
      excluded.informacion_desgaste, excluded.observaciones, excluded.source_key
    );
    get diagnostics v_upserted = row_count;
  end if;

  if v_delete_input > 0 then
    delete from public.rop02 r
    using jsonb_array_elements_text(coalesce(p_delete_source_rows,'[]'::jsonb)) d(value)
    where r.source_dataset = p_dataset
      and r.source_row = d.value::integer;
    get diagnostics v_deleted = row_count;
  end if;

  return jsonb_build_object(
    'ok', true,
    'dataset', p_dataset,
    'inputUpserts', v_upsert_input,
    'inputDeletes', v_delete_input,
    'writtenUpserts', v_upserted,
    'deleted', v_deleted,
    'incremental', true,
    'syncedAt', now()
  );
end;
$function$;

-- public.delta_source_versions
CREATE OR REPLACE FUNCTION public.delta_source_versions()
 RETURNS TABLE(source_key text, server_version bigint, synced_at timestamp with time zone, rows bigint)
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  with rop02_sources as (
    select s.dataset source_key,
      floor(extract(epoch from coalesce(max(r.synced_at),'epoch'::timestamptz))*1000)::bigint server_version,
      max(r.synced_at) synced_at,
      count(r.id)::bigint rows
    from public.rop02_project_sources s
    left join public.rop02 r on r.source_dataset=s.dataset and r.source_row is not null
    where s.enabled
    group by s.dataset
  ), typed as (
    select 'rop05'::text source_key,floor(extract(epoch from coalesce(max(synced_at),'epoch'::timestamptz))*1000)::bigint server_version,max(synced_at) synced_at,count(*)::bigint rows from public.rop05
    union all select 'rma15_fs',floor(extract(epoch from coalesce(max(synced_at),'epoch'::timestamptz))*1000)::bigint,max(synced_at),count(*)::bigint from public.rma15 where source_dataset='rma15_fs'
    union all select 'rma15_jm',floor(extract(epoch from coalesce(max(synced_at),'epoch'::timestamptz))*1000)::bigint,max(synced_at),count(*)::bigint from public.rma15 where source_dataset='rma15_jm'
    union all select 'lista_equipos',floor(extract(epoch from coalesce(max(synced_at),'epoch'::timestamptz))*1000)::bigint,max(synced_at),count(*)::bigint from public.lista_equipos
    union all select 'insumos',floor(extract(epoch from coalesce(max(synced_at),'epoch'::timestamptz))*1000)::bigint,max(synced_at),count(*)::bigint from public.insumos
  ), generic as (
    select d.dataset source_key,
      coalesce(nullif(max(d.source_version),0),floor(extract(epoch from coalesce(max(d.synced_at),'epoch'::timestamptz))*1000)::bigint) server_version,
      max(d.synced_at) synced_at,count(*)::bigint rows
    from public.delta_dataset_rows d
    where d.dataset <> 'usuarios'
      and d.dataset not in ('rop05','rma15_fs','rma15_jm','lista_equipos','insumos')
    group by d.dataset
  )
  select * from rop02_sources
  union all select * from typed
  union all select * from generic;
$function$;

-- public.sync_rop02_authoritative_low_io_v1
CREATE OR REPLACE FUNCTION public.sync_rop02_authoritative_low_io_v1(p_dataset text, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_deletes jsonb:='[]'::jsonb; v_result jsonb;
begin
  if not private.rop02_source_enabled(p_dataset) then raise exception 'Dataset ROP02 no permitido'; end if;
  if jsonb_typeof(coalesce(p_rows,'[]'::jsonb))<>'array' then raise exception 'p_rows debe ser array'; end if;
  select coalesce(jsonb_agg(r.source_row),'[]'::jsonb) into v_deletes
  from public.rop02 r where r.source_dataset=p_dataset and r.source_row is not null
    and not exists(select 1 from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) x where (x->>'source_row')::integer=r.source_row);
  v_result:=public.apply_rop02_external_delta_v2(p_dataset,coalesce(p_rows,'[]'::jsonb),v_deletes);
  return v_result||jsonb_build_object('sourceRows',jsonb_array_length(coalesce(p_rows,'[]'::jsonb)),'authoritative',true);
end$function$;

-- public.sync_rop02_sheet_dataset
CREATE OR REPLACE FUNCTION public.sync_rop02_sheet_dataset(p_dataset text, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_seen integer := jsonb_array_length(coalesce(p_rows,'[]'::jsonb));
  v_deleted integer := 0;
begin
  if not private.rop02_source_enabled(p_dataset) then
    raise exception 'Dataset ROP02 no permitido: %', p_dataset;
  end if;

  insert into public.rop02(
    fecha,interno,equipo,operador,supervisor_delta,supervisor_vial_cliente,
    turno_trabajo,numero_parte,proyecto,horometro_inicial,horometro_final,
    cantidad_horas,combustible,aceite,descripcion_trabajos,informacion_desgaste,
    observaciones,source_key,source_dataset,source_row,synced_at,updated_at
  )
  select
    nullif(x->>'fecha','')::date,
    x->>'interno',x->>'equipo',x->>'operador',x->>'supervisor_delta',x->>'supervisor_vial_cliente',
    x->>'turno_trabajo',x->>'numero_parte',x->>'proyecto',
    nullif(x->>'horometro_inicial','')::numeric,
    nullif(x->>'horometro_final','')::numeric,
    nullif(x->>'cantidad_horas','')::numeric,
    nullif(x->>'combustible','')::numeric,
    nullif(x->>'aceite','')::numeric,
    x->>'descripcion_trabajos',x->>'informacion_desgaste',x->>'observaciones',
    p_dataset||':'||(x->>'source_row'),p_dataset,(x->>'source_row')::integer,now(),now()
  from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) x
  where coalesce(x->>'source_row','') ~ '^\d+$'
  on conflict(source_dataset,source_row) do update set
    fecha=excluded.fecha,interno=excluded.interno,equipo=excluded.equipo,operador=excluded.operador,
    supervisor_delta=excluded.supervisor_delta,supervisor_vial_cliente=excluded.supervisor_vial_cliente,
    turno_trabajo=excluded.turno_trabajo,numero_parte=excluded.numero_parte,proyecto=excluded.proyecto,
    horometro_inicial=excluded.horometro_inicial,horometro_final=excluded.horometro_final,
    cantidad_horas=excluded.cantidad_horas,combustible=excluded.combustible,aceite=excluded.aceite,
    descripcion_trabajos=excluded.descripcion_trabajos,informacion_desgaste=excluded.informacion_desgaste,
    observaciones=excluded.observaciones,source_key=excluded.source_key,synced_at=now(),updated_at=now();

  delete from public.rop02 r
  where r.source_dataset=p_dataset
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) x
      where coalesce(x->>'source_row','') ~ '^\d+$'
        and (x->>'source_row')::integer=r.source_row
    );
  get diagnostics v_deleted=row_count;

  return jsonb_build_object('ok',true,'dataset',p_dataset,'sourceRows',v_seen,'deleted',v_deleted);
end;
$function$;

create or replace view public.rop02_frontend as
SELECT id,
    fecha,
    interno,
    equipo,
    operador,
    supervisor_delta,
    supervisor_vial_cliente,
    turno_trabajo,
    numero_parte,
    proyecto,
    horometro_inicial,
    horometro_final,
    cantidad_horas,
    combustible,
    aceite,
    descripcion_trabajos,
    informacion_desgaste,
    observaciones,
    source_key,
    created_at,
    updated_at,
    synced_at,
    rop02_classify_state(cantidad_horas, descripcion_trabajos, observaciones) AS estado,
    aceite_text,
    source_dataset,
    source_row
   FROM rop02 r
  WHERE source_row IS NOT NULL AND EXISTS (SELECT 1 FROM public.rop02_project_sources s WHERE s.dataset = r.source_dataset AND s.enabled);;
