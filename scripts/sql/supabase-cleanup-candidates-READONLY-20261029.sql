-- Auditoria SOLO LECTURA de posibles respaldos obsoletos (29/10/2026).
-- Ejecutar manualmente en SQL Editor antes de evaluar una futura migracion.
-- No hace DROP, DELETE, TRUNCATE, UPDATE, VACUUM ni modifica configuraciones.
WITH candidates(table_name) AS (
  VALUES
    ('rop05_backup_pre_drive_reconcile_20260814'),
    ('rop02_rebuild'),
    ('rma15_backup_pre_drive_reconcile_20260814'),
    ('rop02_backup_pre_rebuild_20260814'),
    ('rop02_backup_pre_drive_reconcile_20260814'),
    ('rop02_orphans_backup_20260814')
), tables AS (
  SELECT v.table_name, c.oid, c.reltuples::bigint AS estimated_rows,
         pg_total_relation_size(c.oid) AS bytes,
         coalesce(st.seq_scan,0) AS seq_scans,
         coalesce(st.idx_scan,0) AS idx_scans,
         coalesce(st.n_tup_ins,0) AS stats_inserts,
         coalesce(st.n_tup_upd,0) AS stats_updates,
         coalesce(st.n_tup_del,0) AS stats_deletes
  FROM candidates v
  LEFT JOIN pg_class c ON c.relname=v.table_name
    AND c.relnamespace='public'::regnamespace
    AND c.relkind IN ('r','p')
  LEFT JOIN pg_stat_user_tables st ON st.relid=c.oid
)
SELECT t.table_name,
       t.oid IS NOT NULL AS exists_now,
       pg_size_pretty(t.bytes) AS total_size,
       t.estimated_rows, t.seq_scans, t.idx_scans,
       t.stats_inserts, t.stats_updates, t.stats_deletes,
       (SELECT count(*) FROM pg_constraint f
          WHERE f.contype='f' AND (f.conrelid=t.oid OR f.confrelid=t.oid)) AS foreign_key_count,
       (SELECT count(*) FROM pg_trigger tr
          WHERE tr.tgrelid=t.oid AND NOT tr.tgisinternal) AS custom_trigger_count,
       (SELECT count(*) FROM pg_proc p
          JOIN pg_namespace n ON n.oid=p.pronamespace
          WHERE n.nspname='public' AND p.prosrc ILIKE '%'||t.table_name||'%') AS public_function_text_mentions,
       (SELECT count(*) FROM pg_views v
          WHERE v.schemaname='public' AND v.definition ILIKE '%'||t.table_name||'%') AS public_view_text_mentions,
       (SELECT count(*) FROM cron.job j
          WHERE j.command ILIKE '%'||t.table_name||'%') AS cron_text_mentions
FROM tables t ORDER BY t.bytes DESC NULLS LAST;
-- IMPORTANTE: un resultado 0 NO descarta SQL dinamico ni dependencias externas.
