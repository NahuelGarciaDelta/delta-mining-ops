-- Catálogo público mínimo de ROP02. No expone spreadsheet_id ni GID.
-- Migración aplicada a Supabase el 20/10/2026.
create or replace function public.rop02_public_catalog()
returns table(dataset text, project text)
language sql stable security definer set search_path = ''
as $body$
 select s.dataset,s.project
 from public.rop02_project_sources s
 where s.enabled=true
 order by s.dataset
$body$;
revoke all on function public.rop02_public_catalog() from PUBLIC;
grant execute on function public.rop02_public_catalog() to anon,authenticated,service_role;
