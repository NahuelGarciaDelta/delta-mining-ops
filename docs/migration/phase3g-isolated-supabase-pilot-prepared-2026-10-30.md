# Fase 3G V1 — Piloto RPC Supabase aislado (preparado, no desplegado)

30/10/2026. Fase 3F aprobada por el usuario (ACK_LOST y luego ACK_CONFIRMED, replayed:false, 8/8 pruebas).

## Estado Supabase
Se encontró un único proyecto conectado: jwfocqaxlckuxoklwyxs (producción). Su estado informado era RESTARTING y la rama main aparecía MIGRATIONS_FAILED. Esas etiquetas no bastan para afirmar una caída. No se creó ni alteró proyecto alguno.

## Paquete entregado
DELTA_OPS_V9_UNIFICADO_FASE3G_SANDBOX_RPC_PREPARADO_20261030.zip:
- DM_UNIFIED_PHASE3G_SANDBOX_RPC_V1.gs: Apps Script para clon, preflight local, ping, una fila sintética y ACK recuperable solo en proyecto Supabase distinto del productivo. La referencia productiva se bloquea; se requiere opt-in explícito y credenciales exclusivas del entorno de pruebas.
- 01_SQL_SOLO_EN_SUPABASE_DE_PRUEBAS.sql: esquema privado delta_3g_sandbox y funciones RPC exclusivas para una prueba con source_row 900000001..900001000. Sin DELETE; solo EXECUTE de service_role; idempotencia por request_id.
- TEST_LOCAL_PHASE3G_V1.cjs: 12/12 pruebas locales aprobadas con HTTP simulado; ningún servidor real contactado.
- LEEME_FASE3G_V1.md y ESTADO_Y_RIESGOS.md.

## Lo que falta
SQL no ejecutado ni verificado en PostgreSQL real. Fase 3G NO aprobada de forma remota. El usuario puede instalar un archivo nuevo en el clon y ejecutar probarMigracionFase3gPreflightV1 sin URL ni claves, para validar que 3D/3F siguen aprobadas. Solo después de disponer de un segundo proyecto separado y revisar costos deben instalarse SQL de pruebas y configurarse credenciales test-only. Nunca usar clave de producción.

No se tocaron Apps Script originales, activadores, Supabase productivo, Vercel ni la rama main.

## Actualización 30/10 — Sandbox confirmado e instalado

Se verificó directamente con Supabase que el proyecto independiente `DELTA-OPS-SANDBOX-3G`, referencia `biztlietuvvonigcfdwy`, está **ACTIVE_HEALTHY**. El proyecto productivo es `jwfocqaxlckuxoklwyxs`, y se comprobó que el sandbox no contenía tablas ROP02/ROP05/RMA15 ni objetos anteriores de la fase 3G.

Se aplicó por `apply_migration` **solo al sandbox** la migración `delta_3g_isolated_synthetic_rpc_v1` correspondiente al archivo `01_SQL_SOLO_EN_SUPABASE_DE_PRUEBAS.sql`, con respuesta **success:true**.

Verificación SQL posterior en sandbox: tablas privadas `delta_3g_sandbox.rows` y `delta_3g_sandbox.receipts` existen y ambas tienen RLS habilitado; 3 RPC `delta_3g_ping_v1`, `delta_3g_apply_v1`, `delta_3g_verify_v1` usan SECURITY INVOKER, EXECUTE permitido a `service_role` y denegado a `anon` y `authenticated`; ping devolvió el contrato esperado; **0 rows y 0 receipts**. Security advisors informa dos avisos **INFO** por tablas con RLS sin políticas; esto es intencional, solo accesibles por `service_role` restringido.

**Compatibilidad de claves:** El usuario compartió una clave `sb_publishable_`, pública y **sin permisos para RPC restringida**. El módulo V1 original esperaba la clave JWT legacy `service_role` (deprecada), por lo que se preparó revisión `DM_UNIFIED_PHASE3G_SANDBOX_RPC_V1_1_SECRET_KEY.gs` para usar `DM_U3G_V1_TEST_SECRET_KEY` en ScriptProperties del clon, exigir `sb_secret_` de **este sandbox**, y enviar únicamente encabezado `apikey` (sin Bearer). Conserva funciones Apps Script `probarMigracionFase3g*V1`. El usuario debe **reemplazar** el contenido del archivo 3G existente, **no agregar duplicado con mismas funciones**. Revisión local 13/13 tests PASS. Archivo y README entregados en nuevo ZIP `DELTA_OPS_V9_FASE3G_ACTUALIZACION_SECRET_KEY_20261030.zip`.

**Aún NO ejecutado:** petición HTTP real desde Apps Script, ping desde cliente, inserción de fila sintética ni ACK remoto. El siguiente paso del usuario es cargar 5 ScriptProperties privadas en clon (nunca por chat), ejecutar preflight y ping. No habilitar producción.


## Fase 3G VALIDADA con Apps Script y RPC real de sandbox

El usuario ejecutó el paso 1 (ACK local omitido) y el paso 2 en su proyecto CLON de Apps Script. Resultado paso 2: `ok:true`, `phase:ACK_CONFIRMED`, `replayed:false` a nivel llamada local, `remoteRequestReplayed:true`, `remoteRows:1`, `remoteReceipts:1`, `realQueueTouched:false`, `productionTouched:false`, `readyForProductionWrites:false`. Request ID: `8da8d3c0-4f99-403f-b8dc-cf89de34e05a`.

**Postverificación independiente de Supabase**: SQL SELECT en proyecto de pruebas `biztlietuvvonigcfdwy` verificó **1 fila** y **1 comprobante** con ese request ID, dataset `rop05`, source_row `900000001`, revisión `1`, marker `DELTA_3G_SANDBOX_ONLY`, y recibo original `accepted:1`, `writtenUpserts:1`, `deleted:0`. Se demuestra idempotencia del reintento RPC sobre un payload sintético. El comprobante original almacena `replayed:false` por ser el resultado de la primera escritura; el paso 2 informó `remoteRequestReplayed:true` en Apps Script.

**Estado:** 3G aprobada como prueba de RPC real en ambiente aislado, NO para sincronización productiva. Aún no existe consumidor de cambios reales de la cola 3D con ACK remoto ni comparación integral de datos tipados/raw_data ni garantía del corte a un único escritor. No copiar credenciales test a producción. 
