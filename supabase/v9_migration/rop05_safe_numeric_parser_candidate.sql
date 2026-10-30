-- CANDIDATO V9 - NO EJECUTAR EN PRODUCCIÓN HASTA AUTORIZAR EL CORTE
-- Función nueva y aislada. NO reemplaza private.rop05_try_numeric,
-- que también participa en cargas de RMA15.
-- Prueba equivalente: 12/12 PASS en delta_4g_sandbox del proyecto sandbox.
create or replace function private.rop05_try_numeric_v2(p_value text)
returns numeric language plpgsql immutable
set search_path = pg_catalog
as $fn$
declare v text := btrim(coalesce(p_value,''));
begin
  if v='' or upper(v) in ('SIN DATOS','S/D','N/A','NA','-') then return null; end if;
  -- Una coma o un punto se consideran decimales por defecto (12.5 -> 12.5).
  if v ~ '^[+-]?[0-9]+([.,][0-9]+)?$' then
     return replace(v,',','.')::numeric;
  end if;
  -- Separadores de miles no ambiguos y repetidos: 1.234.567 / 1,234,567.
  if v ~ '^[+-]?[0-9]{1,3}([.][0-9]{3}){2,}$' then return replace(v,'.','')::numeric; end if;
  if v ~ '^[+-]?[0-9]{1,3}(,[0-9]{3}){2,}$' then return replace(v,',','')::numeric; end if;
  -- Notación mixta ES (1.234,56) y EN (1,234.56).
  if v ~ '^[+-]?[0-9]{1,3}([.][0-9]{3})+,[0-9]+$'
  then return replace(replace(v,'.',''),',','.')::numeric; end if;
  if v ~ '^[+-]?[0-9]{1,3}(,[0-9]{3})+[.][0-9]+$'
  then return replace(v,',','')::numeric; end if;
  return null; -- formatos no confiables: fallar cerrado
exception when numeric_value_out_of_range then return null;
end $fn$;
revoke all on function private.rop05_try_numeric_v2(text) from public,anon,authenticated;
grant execute on function private.rop05_try_numeric_v2(text) to service_role;
-- No reemplaza el parser antiguo ni reescribe ninguna fila productiva.
