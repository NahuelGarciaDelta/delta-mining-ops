# José María ROP02 — Conciliación de filas faltantes (27/10/2026)

## Diagnóstico comprobado
- En la hoja `R_OP02_JM`, el 26/10/2026 había **64** partes; el destino inicialmente tenía **49**.
- Se recuperaron los **15** faltantes mediante UPSERT selectivo por `source_dataset=rop02_jm` y `source_row`; **0** deletes. Tras la reparación: 10.111 filas, `source_row` 5..10115, ningún hueco.
- Auditoría `private.delta_external_sync_log`, registro **3455** del 27/10/2026 13:51 UTC: `ERROR_INCREMENTAL` y RPC `apply_rop02_external_delta_v2` HTTP **504** (`upstream request timeout`), 5 filas. Coincide en cantidad con uno de los bloques omitidos, pero no demuestra la causa de las otras diez.
- Las publicaciones `OK_INCREMENTAL` verifican los *lotes recibidos*, NO que todo Google Sheets llegó; no había conciliación independiente ni cron para José María.
- El registro `rop02_sync_health` de importación histórica estaba desactualizado desde septiembre; no se usa como prueba de salud del webhook.
- No hubo que cambiar planilla ni el script V9 para este mecanismo.

## Solución implantada en Supabase
Edge Function: `rop02-jm-tail-reconcile` — `2026-10-27-ROP02-JM-TAIL-RECONCILE-V1`.

Cron: `rop02-jm-tail-reconcile-hourly`, ID **32**, `43 * * * *` (43 minutos de cada hora, UTC). No cambia ni desactiva los triggers anteriores.

Cada hora la función:
1. Verifica `x-delta-sync-token` con RPC existente, toma el último `source_row` de Supabase.
2. Lee hasta las últimas **320 filas físicas** del libro de José María mediante el Apps Script V9 actual, con `offset` y `limit`, sin solicitar las 10.000+ filas completas; admite hasta tres páginas si hay retraso.
3. Verifica libro, GID, pestaña, paginación, modificación estable y ausencia de filas físicas vacías en la página. El endpoint V9 no devuelve `_sourceRow`: si hubiera un blanco en la página, el proceso **falla cerrado**, sin inferir posiciones.
4. Consulta por `source_row` las filas ya almacenadas, detecta las ausentes, y envía exclusivamente esas filas a la RPC incremental existente con `p_delete_source_rows=[]`. **Nunca elimina ni reescribe las existentes**.
5. Reconsulta los IDs para verificar persistencia y confirma la integridad del total; registra resultado en `public.sheet_sync_health` bajo `dataset='rop02_jm_tail_reconcile'` (separado de la salud del sincronizador general).
6. Ante 504 o error de Google, conserva error en salud y el siguiente cron vuelve a comparar antes de reintentar, evitando duplicados.

## Validación
- 433 pruebas aprobadas, 0 fallidas, build correcto.
- Primera llamada real Edge V1: HTTP **200**, `scanned=320`, `sourceFrom=9796`, `sourceTo=10115`, `recovered=0`, `missingFound=0`, `remainingInWindow=0`, `potentialGapsOutsideWindow=0`, ~4,3 s.
- Esta primera prueba comprueba el circuito de lectura/detección; la recuperación ante fallo fue cubierta por mock unitario y la recuperación de los 15 ocurrió antes con RPC real.

## Monitoreo de operación
```sql
select dataset,last_attempt_at,last_success_at,last_error,consecutive_failures,
       source_rows,destination_rows,duration_ms,details
from public.sheet_sync_health
where dataset='rop02_jm_tail_reconcile';

select jobid,jobname,schedule,active
from cron.job
where jobname='rop02-jm-tail-reconcile-hourly';

select r.start_time,r.status,left(r.return_message,300) as detalle
from cron.job_run_details r where r.jobid=32
order by r.start_time desc limit 15;

select source_dataset,count(*) as filas,min(source_row) primera,max(source_row) ultima,
       (max(source_row)-min(source_row)+1-count(*)) as posibles_huecos
from public.rop02 where source_dataset='rop02_jm'
group by source_dataset;
```

## Revertir inmediatamente sin tocar los datos
```sql
select cron.unschedule('rop02-jm-tail-reconcile-hourly');
```
El código Edge queda desplegado pero no se invoca automáticamente. No eliminar filas ni editar otras funciones.

## Límites y mejoras futuras
- Es **conciliación de ausencias recientes**, no sustituto de confirmaciones del script ni garantía absoluta de cero fallos.
- No repara diferencias de contenido en filas que ya existen: evita sobreescribir correcciones manuales.
- Detecta las últimas 320 filas; si hay un corte muy antiguo o más de tres páginas de atraso, notifica error (no hace limpieza masiva). Si el libro incorpora filas físicas vacías, habrá que adaptar Apps Script para exponer `_sourceRow` antes de ampliar el proceso.
- Para verificar la causa de todas las omisiones, revisar la confirmación/reintentos y cursor incremental del *script real* `actualizarROP02`; esperar a que el usuario lo comparta, sin modificarlo de manera unilateral.
- La transferencia extra está limitada a un pequeño segmento del origen una vez/hora, evitando egress de una réplica histórica completa; medir facturación real en Usage.
