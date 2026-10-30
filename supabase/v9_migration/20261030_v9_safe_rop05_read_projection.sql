-- DELTA OPS V9 — safe private read projection from shadow revisions.
-- DOES NOT alter legacy typed columns or V8.1 code.
create function delta_v9.rop05_numeric_safe_v1(p_value text)
returns numeric language plpgsql immutable
set search_path=pg_catalog
as $fn$
declare v text:=btrim(coalesce(p_value,''));
begin
 if v='' or upper(v) in ('SIN DATOS','S/D','N/A','NA','-') then return null;end if;
 if v ~ '^[+-]?[0-9]+([.,][0-9]+)?$' then return replace(v,',','.')::numeric;end if;
 if v ~ '^[+-]?[0-9]{1,3}([.][0-9]{3}){2,}$' then return replace(v,'.','')::numeric;end if;
 if v ~ '^[+-]?[0-9]{1,3}(,[0-9]{3}){2,}$' then return replace(v,',','')::numeric;end if;
 if v ~ '^[+-]?[0-9]{1,3}([.][0-9]{3})+,[0-9]+$' then return replace(replace(v,'.',''),',','.')::numeric;end if;
 if v ~ '^[+-]?[0-9]{1,3}(,[0-9]{3})+[.][0-9]+$' then return replace(v,',','')::numeric;end if;
 return null;
exception when numeric_value_out_of_range then return null;
end $fn$;
revoke all on function delta_v9.rop05_numeric_safe_v1(text) from public,anon,authenticated,service_role;
grant execute on function delta_v9.rop05_numeric_safe_v1(text) to service_role;

create view delta_v9.rop05_snapshot_read_v1 with (security_invoker=true) as
select
 b.task_key,
 b.dataset,
 b.legacy_source_row,
 sh.shadow_revision as captured_shadow_revision,
 sh.draft_sha256 as captured_payload_sha256,
 sh.captured_at as captured_at,
 b.productivity_state,
 b.match_class,
 b.validation_status,
 (b.productivity_state='WAITING_PRODUCTIVITY_NO_SEND') as productivity_pending,
 true as is_provisional,
 'NOT_PUBLISHED'::text as publication_status,
 (data.values->>0) as fecha_iso,
 (data.values->>1) as supervisor,
 (data.values->>2) as proyecto,
 (data.values->>3) as interno,
 (data.values->>4) as numero_parte,
 (data.values->>5) as tipo_equipo,
 (data.values->>6) as tarea,
 delta_v9.rop05_numeric_safe_v1(data.values->>7) as horas_productivas,
 delta_v9.rop05_numeric_safe_v1(data.values->>8) as largo,
 delta_v9.rop05_numeric_safe_v1(data.values->>9) as ancho,
 delta_v9.rop05_numeric_safe_v1(data.values->>10) as profundidad,
 delta_v9.rop05_numeric_safe_v1(data.values->>11) as cantidad_produccion,
 (data.values->>12) as unidad,
 (data.values->>13) as observaciones,
 (data.values->>14) as mes,
 data.values as payload_15_strings,
 coalesce(pl.state,'BLOCKED_SOURCE_CHANGED') as publication_block
from delta_v9.rop05_identity_bridge_v1 b
join lateral(
 select h.shadow_revision,h.draft_sha256,h.captured_at,h.canonical_json
 from delta_v9.rop05_shadow_revisions_v1 h
 where h.task_key=b.task_key order by h.shadow_revision desc limit 1
) sh on true
cross join lateral (select sh.canonical_json::jsonb as values) data
left join delta_v9.rop05_publication_plan_v1 pl on pl.task_key=b.task_key;
revoke all on delta_v9.rop05_snapshot_read_v1 from public,anon,authenticated,service_role;
grant select on delta_v9.rop05_snapshot_read_v1 to service_role;
