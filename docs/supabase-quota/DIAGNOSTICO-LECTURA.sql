-- Prepared only. NOT executed. Requires a read-only administrator connection.
-- Never EXPLAIN ANALYZE a mutating function or run migrations in this audit.
SELECT schemaname, relname, n_live_tup, seq_scan, idx_scan
FROM pg_stat_user_tables ORDER BY seq_scan DESC;
SELECT schemaname, relname, indexrelname, idx_scan
FROM pg_stat_user_indexes ORDER BY idx_scan DESC;
-- Run only if pg_stat_statements is installed/authorized; no SQL text containing literals exported.
SELECT queryid, calls, rows, total_exec_time, mean_exec_time, shared_blks_hit, shared_blks_read
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 30;
SELECT application_name, state, count(*) AS connections
FROM pg_stat_activity GROUP BY application_name,state;
SELECT table_schema,table_name FROM information_schema.tables
WHERE table_schema IN ('public','cron') ORDER BY table_schema,table_name;
-- Inspect schema/indexes before tailoring a plan; this does not execute the scan.
EXPLAIN (FORMAT JSON)
SELECT fecha,interno,source_key,estado FROM public.rop02_frontend
WHERE fecha >= DATE '2026-09-26' AND fecha <= DATE '2026-10-25'
ORDER BY fecha DESC,source_key ASC LIMIT 250;
