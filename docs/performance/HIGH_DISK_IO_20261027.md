# DELTA Mining OPS — Auditoría High Disk I/O (27/10/2026)

## Fuente y alcance
- Correo de Supabase recibido el 26/10/2026: el proyecto `jwfocqaxlckuxoklwyxs` agota el presupuesto de Disk I/O.
- Diagnóstico efectuado sobre PostgreSQL productivo sin escribir registros de negocio, sin desplegar frontend y sin modificar Google Sheets.
- El indicador de Supabase Disk IO Budget es distinto de `pg_stat_database.temp_bytes`. No equiparar ambos valores ni prometer una reducción porcentual del presupuesto hasta revisar Observability.

## Señales observadas
- `pg_stat_database`: `temp_files=1339`, `temp_bytes=7406029832` (7.06 GiB aproximados acumulados); `cache_hit_pct=99.888`.
- Configuración: `work_mem=2184kB`; conviene no subirla globalmente por el riesgo de memoria en Free.
- `pg_stat_statements`: alta escritura temporal en paginaciones ordenadas de ROP05, ROP02 frontend y RMA15 frontend.
- ROP05, caso `ORDER BY source_row LIMIT 1000 OFFSET 4000`, antes: `Sort Method: external merge, Disk: 7600kB`, tiempo observado `1510.587 ms`.

## Cambio aplicado — índice global ROP05
Migraciones en Supabase:
1. `add_rop05_source_row_sort_index_low_disk_io_20261027`: primer índice parcial; el plan no lo utilizó.
2. `replace_partial_rop05_source_row_index_with_global_sort_index_20261027`: elimina el índice parcial y crea `idx_rop05_source_row_global_order_20261027` sobre `public.rop05(source_row)`.

Validación: `Index Scan using idx_rop05_source_row_global_order_20261027`, sin archivos temporales para ese orden; tiempo observado `128.710 ms`; índice `232 kB`.

Rollback exclusivo de este cambio:
```sql
DROP INDEX IF EXISTS public.idx_rop05_source_row_global_order_20261027;
```

## Cambio aplicado — índice de orden físico ROP02
- Migración: `add_rop02_source_row_global_sort_index_20261027`.
- Índice `public.idx_rop02_source_row_global_order_20261027` sobre `rop02(source_row)`, aprox. `344 kB`.
- Caso de lectura ordenada por `source_row`: PostgreSQL pasó a `Index Scan`, sin Sort; benchmark de columnas estrechas `814.750 ms` antes a `13.411 ms` después (variaciones de cache/carga pueden influir).
- **Limitación:** las consultas ROP02 frontend más costosas de `pg_stat_statements` ordenan por `fecha,source_key`, NO por `source_row`. Este índice no elimina el consumo temporal de esas rutas.

Rollback exclusivo:
```sql
DROP INDEX IF EXISTS public.idx_rop02_source_row_global_order_20261027;
```

## Experimento no conservado
- `add_rop02_fecha_source_key_sort_index_20261027` creó `idx_rop02_fecha_source_key_global_20261027`.
- La consulta con `source_key LIKE 'SRC|ROP02_JM|%'` siguió usando `Seq Scan + Hash Join + Sort external merge` y el índice no tuvo uso (`idx_scan=0`).
- Se retiró mediante `remove_unused_rop02_fecha_source_key_trial_index_20261027`; no quedó el índice de prueba.

## Riesgos y próximos pasos
- No tocar la frecuencia de los cron funcionales a ciegas: el cron ROP02 JM de conciliación permanece desactivado `jobid=32` hasta corregir y publicar el script V9 y adaptar la función.
- Perfil real de las consultas frecuentes ROP02: `source_key LIKE $1 ORDER BY fecha ASC,source_key ASC` y `ORDER BY fecha DESC,source_key ASC`; requerirían pruebas en preview para optimizar el consumo sin cambiar resultado, y monitoreo del plan de ejecución.
- RMA15 frontend agrega insumos por `GROUP BY`; la consulta filtrada reproduce `GroupAggregate` y debe revisarse antes de modificar la vista.
- No se borraron ni modificaron partes originales ni datos de las tablas, no se alteraron funciones productivas ni frontend.
- Próximas mediciones de `temp_bytes` son acumulativas: comparar DELTAs en ventanas homogéneas y completar con el indicador real de Supabase Database Health/Observability.
