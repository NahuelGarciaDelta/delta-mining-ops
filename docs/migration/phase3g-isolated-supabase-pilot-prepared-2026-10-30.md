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