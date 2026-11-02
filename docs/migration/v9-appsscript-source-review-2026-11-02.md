# Revisión real del Apps Script V9 — 02/11/2026

Fuente: 12 archivos adjuntos por el usuario y bloques pegados de las fases 3E/3F/3G/4C/4D/4H/4I. **No subir código completo a GitHub público:** contiene IDs internos de hojas; el bloque de configuración 3G incluye una clave privada de sandbox en texto plano. No publicar ni reproducir ese valor.

## Hallazgos
1. Los 12 adjuntos compilan sintácticamente con `node --check` por stdin. Los archivos 3I (7) y (8) son idénticos, no duplicar en el proyecto Apps Script.
2. El adjunto 4B/4E/4F contiene `dmV9Outbox4fPrepararEntregasV1` y reglas de productividad diferida. `generarROP05NuevoV9Aplicar` sigue bloqueado por `throw`, incluso tras verificar el gate manual. **No eliminar ese bloqueo**.
3. En `dmV9U4fPlan_`, `String(m.productivityState||'READY')` convierte un estado ausente en READY, que es peligroso para entregas futuras. Parche de una línea: rechazar entrada sin estado. No cambia los 15 campos ni el cálculo productivo.
4. El outbox 4F tiene JSON como array de 15 cadenas. El RPC existente `public.v9_ingest_accept_batch_v1` del sandbox consume un array de registros con `payload` JSONB **objeto** y requiere `record_id`, `delivery_revision`. Se necesita adaptador explícito que preserve los 15 campos y meta `_v9`, y compare el SHA de fuente separado del hash remoto del objeto. **Nunca enviar el array de 4F directamente ni tratar los 53 receipts sandbox como ACK reales de V9 productivo**.
5. El Apps Script 4I ya separa las revisiones de borrador de entrega pero ejecuta un preview con `verifiedAcks=[]`; 4F no persiste entregas remotas. No hay que habilitar envío ni desactivar V8.1 en ese estado.

## Verificación offline
Se cargó el código real del adjunto 4B en Node VM con `Utilities.computeDigest` SHA256 simulado. Diez ensayos de regresión pasaron con el código original; el undécimo, estado de productividad ausente, falló como se esperaba. En código corregido: **11/11 PASS**.
Casos: primer snapshot, WAITING, transición diferida sin cambio de hash, revisión 2, hueco histórico, ausencia sin DELETE, traslado físico sin nueva versión, rechazo de ACK inventado, digest adulterado, tarea 3 incompleta y estado ausente fail-closed. Son pruebas sintéticas locales, no instalación real en GAS.

## Seguridad antes de nuevas pruebas
Revocar/rotar la clave `sb_secret_` del SANDBOX que se pegó en `configurarPropiedadesFase3g`. Sustituir la propiedad privada `DM_U3G_V1_TEST_SECRET_KEY` en el clon de Apps Script con el nuevo valor. Eliminar de código la función que inserta una clave literal. No enviar la clave a ChatGPT ni guardarla en GitHub. Confirmar que producción no usa esa clave, sin modificar credenciales productivas por este incidente.

## Aplicación mínima
Modificar solamente `DM_UNIFIED_PHASE4B_ROP05_GENERADOR_NO_DESTRUCTIVO_V1.gs` del CLON: aplicar `patches/v9-4f-productivity-fail-closed.patch` o sustituir el archivo por el candidato entregado al usuario. **No ejecutar** `generarROP05NuevoV9Aplicar`, no crear activadores, no liberar compuerta productiva.

## Siguiente avance
Aprovechar el 4D/4I **existente** para preparar un adaptador sintético 4F -> `v9_ingest_accept_batch_v1`, implementar recuperación de ACK a partir del probe remoto y recibos duraderos, y probar revisiones reales en sandbox sin dar por cerrada la productividad pendiente. Después evaluar un canary reversible autorizado, con V8.1 como escritor único hasta entonces.
