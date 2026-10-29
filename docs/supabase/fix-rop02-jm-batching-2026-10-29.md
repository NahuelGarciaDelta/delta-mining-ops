# Corrección ROP02 JM y lecturas indexadas — 29/10/2026

## Diagnóstico confirmado (producción, solo lectura)
- La tabla public.rop02 contiene 10.207 registros físicos de rop02_jm.
- Google Apps Script intenta hacer un snapshot completo y PostgreSQL rechaza su operación con: Delta ROP02 demasiado grande: upserts 10207, deletes 0.
- apply_rop02_external_delta_v2 impone un límite de 10.000 registros por RPC. Se conserva ese límite como protección.
- La biblioteca de código conserva el backend V8.1 del 29/09 con dos declaraciones de deltaSyncRop02_. La última llama sync_rop02_authoritative_low_io_v1. No está confirmado que ese archivo coincida con el desplegado actualmente.

## Parche Apps Script V8.2 (preparado, NO desplegado)
En el chat se entregó Delta_ROP02_JM_Optimizacion_Segura_29-10-2026.zip, con el parche puntual y archivo completo referencial.
Para José María con más de 10.000 filas: validar fuente completa y filas únicas; contar destino; bloquear una disminución inesperada; hacer upserts en lotes de 350 sin bajas; confirmar respuesta y conteo; solo entonces permitir guardar huella V8. Si falla, la reconciliación queda pendiente sin borrar registros.
Los demás frentes y los datasets de hasta 10.000 filas conservan la RPC de antes.
IMPORTANTE: no reemplazar un Apps Script instalado por un archivo histórico sin comparar primero sus diferencias. El conector actual no permite desplegar en Apps Script.

## Optimización frontend (solo Preview)
En src/services/supabaseReadApi.js se añade el filtro source_dataset=eq.[dataset] a las consultas ROP02 tipadas, manteniendo source_key LIKE y el orden original.
Todos los registros de las cinco fuentes verificadas coinciden con ambos filtros, sin discrepancias. PostgreSQL usa el índice existente rop02_source_dataset_fecha_source_key_idx.
EXPLAIN ANALYZE (solo lectura, 1.000 partes de JM): filtro anterior 428,466 ms / 1.124 bloques compartidos, filtro nuevo 13,350 ms / 735 bloques. Medición puntual, no una garantía de ahorro mensual.
Se agregó tests/rop02-indexed-source.test.mjs para conservar el contrato de las cinco fuentes.

## Seguridad
No se modificaron Supabase SQL, tablas, índices, Edge Functions, cron ni el Apps Script activo. main tampoco se modificó.
Las bajas automáticas JM quedan bloqueadas para fuentes mayores de 10.000; cualquier eliminación requiere revisión manual de OT.
Antes de pasar a main probar filtros, paginación, exportaciones, cinco fuentes ROP02 y login en Preview.