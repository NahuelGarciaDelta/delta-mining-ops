-- PROPOSAL ONLY. Not applied. Requires explicit production approval and isolated SQL tests.
-- Restore exact retrieved function body, preserving signature and existing grants.
CREATE OR REPLACE FUNCTION public.sync_typed_dataset(p_dataset text, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_seen int:=jsonb_array_length(coalesce(p_rows,'[]'::jsonb)); v_deleted int:=0;
begin
  if p_dataset='rop05' then
    insert into rop05(source_dataset,source_row,fecha,mes,ancho,largo,profundidad,tarea,proyecto,interno,supervisor,tipo_equipo,numero_parte,unidad,horas_productivas,cantidad_produccion,observaciones,raw_data,synced_at)
    select p_dataset,(x->>'source_row')::int,(x->>'fecha')::date,x->>'mes',nullif(x->>'ancho','')::numeric,nullif(x->>'largo','')::numeric,nullif(x->>'profundidad','')::numeric,x->>'tarea',x->>'proyecto',x->>'interno',x->>'supervisor',x->>'tipo_equipo',x->>'numero_parte',x->>'unidad',nullif(x->>'horas_productivas','')::numeric,nullif(x->>'cantidad_produccion','')::numeric,x->>'observaciones',coalesce(x->'raw_data','{}'),now() from jsonb_array_elements(coalesce(p_rows,'[]')) x
    on conflict(source_dataset,source_row) do update set fecha=excluded.fecha,mes=excluded.mes,ancho=excluded.ancho,largo=excluded.largo,profundidad=excluded.profundidad,tarea=excluded.tarea,proyecto=excluded.proyecto,interno=excluded.interno,supervisor=excluded.supervisor,tipo_equipo=excluded.tipo_equipo,numero_parte=excluded.numero_parte,unidad=excluded.unidad,horas_productivas=excluded.horas_productivas,cantidad_produccion=excluded.cantidad_produccion,observaciones=excluded.observaciones,raw_data=excluded.raw_data,synced_at=now();
    delete from rop05 r where r.source_dataset=p_dataset and not exists(select 1 from jsonb_array_elements(coalesce(p_rows,'[]')) x where (x->>'source_row')::int=r.source_row); get diagnostics v_deleted=row_count;
  elsif p_dataset in ('rma15_fs','rma15_jm') then
    insert into rma15(source_dataset,source_row,fecha_ot,proyecto,equipo,interno,km_hs,tipo_mantenimiento,equipo_operativo,turno,lugar,intervencion,observaciones,mail_avisado,raw_data,synced_at)
    select p_dataset,(x->>'source_row')::int,(x->>'fecha_ot')::date,x->>'proyecto',x->>'equipo',x->>'interno',nullif(x->>'km_hs','')::numeric,x->>'tipo_mantenimiento',nullif(x->>'equipo_operativo','')::boolean,x->>'turno',x->>'lugar',x->>'intervencion',x->>'observaciones',x->>'mail_avisado',coalesce(x->'raw_data','{}'),now() from jsonb_array_elements(coalesce(p_rows,'[]')) x
    on conflict(source_dataset,source_row) do update set fecha_ot=excluded.fecha_ot,proyecto=excluded.proyecto,equipo=excluded.equipo,interno=excluded.interno,km_hs=excluded.km_hs,tipo_mantenimiento=excluded.tipo_mantenimiento,equipo_operativo=excluded.equipo_operativo,turno=excluded.turno,lugar=excluded.lugar,intervencion=excluded.intervencion,observaciones=excluded.observaciones,mail_avisado=excluded.mail_avisado,raw_data=excluded.raw_data,synced_at=now();
    delete from rma15 r where r.source_dataset=p_dataset and not exists(select 1 from jsonb_array_elements(coalesce(p_rows,'[]')) x where (x->>'source_row')::int=r.source_row); get diagnostics v_deleted=row_count;
    delete from rma15_insumos i using rma15 r where i.rma15_id=r.id and r.source_dataset=p_dataset;
    insert into rma15_insumos(rma15_id,posicion,codigo,nombre,cantidad)
    select r.id,(i->>'posicion')::smallint,i->>'codigo',i->>'nombre',nullif(i->>'cantidad','')::numeric from jsonb_array_elements(coalesce(p_rows,'[]')) x join rma15 r on r.source_dataset=p_dataset and r.source_row=(x->>'source_row')::int cross join lateral jsonb_array_elements(coalesce(x->'insumos','[]')) i;
  elsif p_dataset='lista_equipos' then
    insert into lista_equipos(source_dataset,source_row,codigo_nuevo,codigo_drusila,familia,marca,modelo,potencia,numero_serie,vida_util_hs_km,lugar_alquiler,horas,horas_trabajo_mes,tipo_combustible,anio_fabricacion,cantidad_neumaticos,horas_hombre_mecanico,consumo_combustible,capacidad,fecha_ingreso,costo_local_usd,tarifa_mensual_usd,costo_neumatico_unidad,propiedad,raw_data,synced_at)
    select p_dataset,(x->>'source_row')::int,x->>'codigo_nuevo',x->>'codigo_drusila',x->>'familia',x->>'marca',x->>'modelo',x->>'potencia',x->>'numero_serie',nullif(x->>'vida_util_hs_km','')::numeric,x->>'lugar_alquiler',nullif(x->>'horas','')::numeric,nullif(x->>'horas_trabajo_mes','')::numeric,x->>'tipo_combustible',nullif(x->>'anio_fabricacion','')::int,nullif(x->>'cantidad_neumaticos','')::int,nullif(x->>'horas_hombre_mecanico','')::numeric,x->>'consumo_combustible',x->>'capacidad',nullif(x->>'fecha_ingreso','')::date,nullif(x->>'costo_local_usd','')::numeric,nullif(x->>'tarifa_mensual_usd','')::numeric,nullif(x->>'costo_neumatico_unidad','')::numeric,x->>'propiedad',coalesce(x->'raw_data','{}'),now() from jsonb_array_elements(coalesce(p_rows,'[]')) x
    on conflict(source_dataset,source_row) do update set codigo_nuevo=excluded.codigo_nuevo,codigo_drusila=excluded.codigo_drusila,familia=excluded.familia,marca=excluded.marca,modelo=excluded.modelo,potencia=excluded.potencia,numero_serie=excluded.numero_serie,vida_util_hs_km=excluded.vida_util_hs_km,lugar_alquiler=excluded.lugar_alquiler,horas=excluded.horas,horas_trabajo_mes=excluded.horas_trabajo_mes,tipo_combustible=excluded.tipo_combustible,anio_fabricacion=excluded.anio_fabricacion,cantidad_neumaticos=excluded.cantidad_neumaticos,horas_hombre_mecanico=excluded.horas_hombre_mecanico,consumo_combustible=excluded.consumo_combustible,capacidad=excluded.capacidad,fecha_ingreso=excluded.fecha_ingreso,costo_local_usd=excluded.costo_local_usd,tarifa_mensual_usd=excluded.tarifa_mensual_usd,costo_neumatico_unidad=excluded.costo_neumatico_unidad,propiedad=excluded.propiedad,raw_data=excluded.raw_data,synced_at=now();
    delete from lista_equipos r where r.source_dataset=p_dataset and not exists(select 1 from jsonb_array_elements(coalesce(p_rows,'[]')) x where (x->>'source_row')::int=r.source_row); get diagnostics v_deleted=row_count;
  elsif p_dataset='insumos' then
    insert into insumos(source_dataset,source_row,codigo,descripcion,precio_unitario,descripcion_adicional,raw_data,synced_at)
    select p_dataset,(x->>'source_row')::int,x->>'codigo',x->>'descripcion',nullif(x->>'precio_unitario','')::numeric,x->>'descripcion_adicional',coalesce(x->'raw_data','{}'),now() from jsonb_array_elements(coalesce(p_rows,'[]')) x
    on conflict(source_dataset,source_row) do update set codigo=excluded.codigo,descripcion=excluded.descripcion,precio_unitario=excluded.precio_unitario,descripcion_adicional=excluded.descripcion_adicional,raw_data=excluded.raw_data,synced_at=now();
    delete from insumos r where r.source_dataset=p_dataset and not exists(select 1 from jsonb_array_elements(coalesce(p_rows,'[]')) x where (x->>'source_row')::int=r.source_row); get diagnostics v_deleted=row_count;
  else raise exception 'Dataset no permitido: %',p_dataset;
  end if;
  return jsonb_build_object('ok',true,'dataset',p_dataset,'sourceRows',v_seen,'deleted',v_deleted);
end $function$
