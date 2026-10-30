-- V9 APP: API de lectura para panel de migración, NO publica ROP05.
-- Ejecutar únicamente con la autorización de integración de V9.
-- La invoca Vercel con service_role desde un backend que valida una clave independiente.
create function public.dm_v9_ops_read_v1(
 p_limit integer default 20,
 p_after text default '',
 p_gate text default ''
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog
as $fn$
declare v_count jsonb;v_rows jsonb;v_total integer;
begin
 if p_limit is null or p_limit<1 or p_limit>50 or length(coalesce(p_after,''))>150
 or length(coalesce(p_gate,''))>80 then
   raise exception 'V9_BAD_PAGINATION_INPUT';
 end if;
 if p_gate<>'' and p_gate not in (
   'BLOCKED_CLOSURE_UNCONFIRMED','BLOCKED_SOURCE_DRIFT',
   'BLOCKED_LEGACY_REVIEW','BLOCKED_NUMERIC_ANOMALY',
   'BLOCKED_PRODUCTIVITY_PENDING','BLOCKED_UNLINKED','BLOCKED_SNAPSHOT_STALE'
 ) then raise exception 'V9_BAD_GATE';end if;
 select coalesce(jsonb_object_agg(g.effective_publication_gate,g.n),'{}'::jsonb)
 into v_count from(
  select effective_publication_gate,count(*) n
  from delta_v9.rop05_publication_live_gate_v1
  group by effective_publication_gate
 )g;
 select count(*) into v_total from delta_v9.rop05_publication_live_gate_v1;
 select coalesce(jsonb_agg(item order by item->>'task_key'),'[]'::jsonb) into v_rows
 from(
  select jsonb_build_object(
    'task_key',g.task_key,'dataset',g.dataset,
    'legacy_source_row',g.legacy_source_row,
    'publication_gate',g.effective_publication_gate,
    'source_status',g.current_source_status,
    'draft_revision',g.plan_draft_revision,
    'delivery_revision',g.proposed_delivery_revision,
    'fecha',s.fecha_iso,'proyecto',s.proyecto,'interno',s.interno,
    'numero_parte',s.numero_parte,'tarea',s.tarea,
    'horas_productivas',s.horas_productivas,
    'cantidad_produccion',s.cantidad_produccion,
    'unidad',s.unidad,'productivity_pending',s.productivity_pending
  ) item
  from delta_v9.rop05_publication_live_gate_v1 g
  left join delta_v9.rop05_snapshot_read_v1 s on s.task_key=g.task_key
  where g.task_key>coalesce(p_after,'')
    and (coalesce(p_gate,'')='' or g.effective_publication_gate=p_gate)
  order by g.task_key
  limit p_limit
 ) x;
 return jsonb_build_object(
  'ok',true,'mode','V9_READ_ONLY',
  'total',v_total,'counts',v_count,'rows',v_rows,
  'publishing_enabled',false,'remote_acks',0,
  'backend','delta_v9','last_preview_generated_at',now()
 );
end
$fn$;
revoke all on function public.dm_v9_ops_read_v1(integer,text,text)
  from PUBLIC,anon,authenticated;
grant execute on function public.dm_v9_ops_read_v1(integer,text,text) to service_role;
