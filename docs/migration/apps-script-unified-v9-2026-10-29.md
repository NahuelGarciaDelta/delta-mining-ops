# Delta Mining OPS — Unificación de Apps Script (rutas verificadas)
Fecha: 2026-10-29
Estado: **preparación / auditoría solamente**. No habilitado en producción.

## Identidad verificada

| Rol | Proyecto | Apps Script deployment |
|---|---|---|
| Base a conservar (V9, actual de la web) | 03 - APP VIEJA | https://script.google.com/macros/s/AKfycbxU-ihsxXTNn2wa5EO1OkSM5FjJ43MwxSx8dY0RjbnJRFBKF0BiNNq7QsuohWxmmeOhog/exec |
| Servicio legado de sincronización (V8.1) | 03 - App delta | https://script.google.com/macros/s/AKfycbxHyZPSNlYFI0LhMhdeByEfYygtMvA-sVEFpCaMAvCLpjLt8VnhWNB2t0cz7mmUomH9/exec |

Fuente confirmatoria: `api/apps-script.js` de la rama main fija `APPS_SCRIPT_TARGET` al despliegue de **APP VIEJA**.
`src/config/app.js` usa ruta same-origin `/api/apps-script`.
`src/services/appsScriptApi.js` envía lecturas tipadas pesadas ROP02/ROP05/RMA15/lista de equipos/insumos directamente a Supabase y reserva Apps Script para escrituras y acciones sin migrar.
La presencia de una URL de web app NO prueba que sus triggers usen esa misma versión: los activadores instalables ejecutan código del proyecto actual (head).

## Disparadores observados en capturas suministradas

- APP VIEJA V9: **14 activadores** `onDatasetSheetChange_`, disparados por edición de hoja.
- App delta V8.1: **15 activadores**, entre ellos `deltaSyncHeartbeatV7_` basado en tiempo, además de `onDatasetSheetChange_`.
- Los detalles exactos de qué hojas están enlazadas a cada trigger y las propiedades privadas aún deben auditarse antes del corte.

## Dependencias y riesgos comprobados

- Legacy V8.1 llama `sync_rop02_authoritative_low_io_v1` enviando 10.207 filas JM en una sola RPC y recibe HTTP 400 (limite de 10.000 en la función interna). Nunca ampliar el límite global ni borrar datos como solución.
- `app_sync_outbox_pull` se invoca desde Apps Script; la tabla `app_sync_outbox` no tenía operaciones pendientes durante la auditoría, pero seguirá requiriendo consumidor si la app vuelve a escribir allí.
- Cron de Supabase existente: reconciliación horaria de cola JM, sincronización El Fierro, insumos, lista de equipos. Mantenerlos a menos que se pruebe reemplazo funcional.
- Otras sincronizaciones V8.1 hacia Supabase (ROP05/RMA15/remitos/stock/usuarios/etc.) no deben darse por reemplazadas solo porque el frontend V9 las pueda consultar.
- Funciones propias V9 como autenticación, edición de ROP02, horómetros y paneles deben preservarse.
- Diferencias verificadas de configuración entre versiones (por ejemplo, nombres de hoja y GID de ROP05): la configuración V9 debe ser autoridad inicial y cotejarse con Sheets en vivo.
- Secretos reales fueron compartidos en el chat (service_role, tokens, secreto de autenticación); NO copiarlos al repositorio. Programar rotación coordinada. Nunca cambiar secreto HMAC de autenticación sin migración de hashes o método alternativo de validación.

## Plan sin romper producción

1. Respaldar ambos proyectos (código + appsscript.json + triggers + nombres de propiedades, **sin valores de secretos**), identificando la versión HEAD y las implementaciones.
2. Clonar V9 en un proyecto Google Apps Script de **pruebas**, sin activadores de escritura y sin publicar reemplazo sobre la URL actual.
3. Añadir al clon solo el dispatcher incremental de V8.1 y lógica de conciliación que falte. Eliminar funciones homónimas duplicadas y resolver puntos de entrada antes de probar.
4. Migrar controladamente flujo por flujo: ROP02 (JM por lotes, cero borrados sin conciliación y El Fierro intacto), ROP05, RMA15, remitos, abastecimiento, equipos, insumos, usuarios y `app_sync_outbox`.
5. Ejecutar pruebas secuenciales: fuente vs. destino, integridad por claves físicas, histórico completo, nuevos registros, ediciones, borrados controlados, idempotencia, errores/timeout y recuperación de reintentos.
6. Capturar baseline de tráfico y errores 24 h antes/después, verificar Supabase health y usuarios reales sin cambiar contraseñas.
7. Actualizar **la implementación existente de V9** para conservar la misma URL usada por `api/apps-script.js` solamente después de validar el clon y tener rollback probado.
8. Desactivar primero `deltaSyncHeartbeatV7_` del proyecto legado, supervisar a diario con validaciones. Retirar los 14 listeners de edición antiguos **solo** después de demostrar que V9 unificado cubre sus flujos.
9. Conservar V8.1 como respaldo sin activadores y registrar versión, responsables, fecha de corte y rollback. No eliminarlo.

## Criterios de aceptación del corte

- Misma URL web para V9 (sin modificación del proxy/frontend).
- ROP02: conteos por fuente, sin pérdidas, sin errores HTTP 400; JM reconciliado y El Fierro no afectado.
- ROP05/RMA15: nuevos partes y mantenimiento visibles sin retrasos inesperados.
- Ediciones de App -> Sheets y Sheets -> Supabase comprobadas; outbox no acumula pendientes.
- Paneles, usuarios, permisos, horómetros, remitos y stock funcionan.
- Respuesta del backend y consumo Supabase no empeoran respecto del baseline.
- Rollback probado (restablecer implementación anterior de V9 y triggers legados en orden controlado).

## Estado de este commit

Esta rama contiene solo documentación de la topología; **no modifica** `main`, Vercel, Supabase, ninguno de los Apps Script ni sus activadores.
