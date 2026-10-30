# Delta OPS V9 independiente — Estado verificable (30-10-2026)

## Objetivo

Construir una **segunda aplicación Delta OPS con frontend, Vercel, Supabase, autenticación y Apps Script V9 propios**, sin mezclar lectores, claves ni escrituras con el Delta OPS V8.1 original. Rama de trabajo: `feature/v9-ops-supabase-app-20261030`, nunca `main`.

## Infraestructura verificada

| Componente | Valor | Estado |
|---|---|---|
| GitHub | `NahuelGarciaDelta/delta-mining-ops`, rama feature V9 | Commits V9, sin merge |
| Vercel | `delta-ops-v9-independiente` (`prj_hD7aPk6DzimYcWUKpT5xUJNw5inr`) | Proyecto propio |
| Deployment Vercel | `https://delta-ops-v9-independiente-dhgz20qe8-delta-mining-s-projects.vercel.app` | **READY del commit baab7dd**; NO incluye los cambios más recientes |
| Supabase independiente | `biztlietuvvonigcfdwy` | Sandbox separado de producción |
| Supabase original | `jwfocqaxlckuxoklwyxs` | **No modificado** por esta etapa |
| Apps Script V9 | Archivo publicador preparado en repo, NO instalado en Apps Script | Sin conexión automática todavía |
| Receptor firmado | Edge Function `delta-v9-ingest` versión 2 | Desplegado; **inactivo sin secreto HMAC** |

Vercel devolvió `HTTP 402 api-deployments-free-per-day` al intentar forzar otro despliegue, pero una compilación por integración Git sí obtuvo READY en el proyecto nuevo con el commit `baab7dd`. El build confirmó `vite build --config vite.v9.config.js`, 30 módulos transformados y `✓ built in 841ms`. **No se ha verificado aún el build del HEAD más reciente**; el proyecto usa protección SSO.

## Aplicación V9

- `v9.html`, `vite.v9.config.js`, `src/standalone/main.jsx`, `src/standalone/style.css`: entrada e interfaz propias.
- `src/standalone/session.js`: autenticación Supabase V9 independiente, tokens y refresh; no reutiliza sesión ni cuenta V8.1.
- `src/standalone/OperationalTable.jsx`: presentación por campos, paginación, búsqueda local, exportación CSV protegida contra fórmulas.
- `api/v9-independent.js`: API de solo lectura contra **exclusivamente** el proyecto `biztlietuvvonigcfdwy`; verifica usuario por Supabase Auth y `app_metadata.v9_role` con `ADMIN` o `OFICINA_TECNICA`.
- Catálogo V9: 13 fuentes, incluyendo ROP02 JM/FS/Filo Sur/Zorro/Fierro, ROP05, RMA15, insumos, lista maestra, combustible, RABA03 y mantenimiento programado. Control cruzado, licitaciones y gestión siguen como módulos **pendientes de migrar**, sin fallback de V8.
- Variables Vercel para URL y clave **publishable** del proyecto V9 (frontend y gateway); sin claves `service_role` en frontend.

**Advertencia:** hoy la app todavía no replica el funcionamiento completo de todas las áreas Delta OPS original. Las pantallas de datos y la navegación son propias, pero solo ROP05 tiene datos; no afirmar que los módulos no migrados están operativos.

## Datos cargados (Supabase V9 independiente)

Fuente de snapshot: pestaña `ENTREGAS_PREPARADAS` del outbox generada por Apps Script V9,
`https://docs.google.com/spreadsheets/d/1eAVJ4UJaPKz0xso_mxbvQCSoVb9viisREppxpaEQ-P8/edit`.

Se importaron al **sandbox V9**, nunca a la base productiva original:

- **5295** tareas ROP05 con `record_id=task_key` estable.
- **5295** IDs únicos; **5295** revisiones iniciales; **53** recibos de importación.
- **8** tareas conservadas como `WAITING_PRODUCTIVITY_NO_SEND`.
- **5295** marcadas `publication_status=PROVISIONAL_NOT_ACKED`; **cero** tratadas como publicación formal.
- **0** hashes inconsistentes y **0** IDs inválidos en la auditoría final.
- `public.v9_operational_rows` contiene el snapshot en formato objeto con campos de ROP05 y metadatos `_v9`; `v9_ingest_versions` y `v9_ingest_receipts` guardan revisiones y ACK internos del **nuevo sandbox** (no son los ACK de corte productivo).
- Las otras 12 fuentes aún tienen **0** filas en el proyecto independiente.

El snapshot es la foto del outbox de pruebas del 30/10/2026 y **todavía no se actualiza automáticamente**.

## Ingesta incremental lista, pero apagada

- `supabase/v9_standalone/v9_ingest_versioned.sql`: RPC server-only, versión remota consecutiva, request UUID idempotente, revisión 1 obligatoria, historial inmutable, sin DELETE. Validaciones sintéticas de revisión 1, replay, revisión 2 de productividad diferida, replay histórico y rechazos de gaps/conflictos; las pruebas sintéticas se ejecutaron en transacciones revertidas.
- `supabase/v9_standalone/v9_ingest_probe.sql`: RPC privado de consulta de versión y huella de origen, solo `service_role`.
- `supabase/functions/delta-v9-ingest/index.ts`: función Edge con firma HMAC-SHA256 sobre `timestamp + '.' + body`, ventana de 300 s, lista blanca de datasets y gateway privado a RPC. `verify_jwt=false` por webhook; **debe verificarse firma propia para toda solicitud**. Sin secreto, devuelve `V9_INGEST_NOT_CONFIGURED`.
- `apps-script-v9/DM_V9_STANDALONE_SIGNED_SYNC.gs`: lee únicamente el outbox V9, consulta `probe`, transmite solo cambios, no borra tareas, conserva identidad y permite productividad diferida. **No instalado en el Apps Script todavía**, no crea triggers. Por defecto `DM_V9_STANDALONE_INGEST_ENABLED` es falso.

Para habilitarlo más adelante, se necesita configurar el mismo secreto HMAC aleatorio (≥32 caracteres) dentro de Supabase Edge Function (`DELTA_V9_INGEST_HMAC_SECRET`) y en **ScriptProperties** del Apps Script CLON V9 (`DM_V9_STANDALONE_INGEST_HMAC_SECRET`). Mantener `DM_V9_STANDALONE_INGEST_ENABLED=false` mientras se prueba. El script reutiliza `DM_U4E_SHADOW_OUTBOX_SPREADSHEET_ID` del clon. **Jamás poner `service_role` en Apps Script o código del navegador**.

## Autenticación

El frontend nuevo usa Supabase Auth propio. **No se importaron usuarios ni contraseñas de V8.1**. Para entrar, corresponde dar de alta/invitar usuarios en el proyecto V9 y asignar el rol en `app_metadata.v9_role` por una operación administrativa segura. No utilizar `user_metadata` como fuente de permisos. La sesión existente del dominio V8.1 no funciona en V9, por diseño de independencia.

## Estado de Vercel y próximos pasos

1. **Compilar y desplegar el commit HEAD actual de V9** cuando Vercel permita un nuevo despliegue, sin tocar el proyecto `delta-mining-ops` original. Verificar build y acceso con cuenta V9 autorizada; no confundir READY del commit `baab7dd` con build actual.
2. Configurar usuario V9 de prueba, sin migrar contraseñas; probar inicio de sesión, renovación de token, rol denegado, 5295 tareas ROP05, filtros, CSV y ausencia de datos cruzados.
3. Instalar/clonar el publicador firmado en Apps Script V9, configurar los secretos en forma segura y probar `dmV9StandaloneSyncPreview`; activar solo con autorización posterior.
4. Migrar ROP02, RMA15, lista maestra, insumos y demás fuentes desde Apps Script V9 y construir los módulos de dominio equivalentes al Delta OPS original, sin usar endpoints o tablas de V8.1 como fallback.
5. Habilitar escritura operacional únicamente después de implementar y probar cada contrato de datos y su rollback. No alterar `main`, V8.1, ni tablas del proyecto original.

Este documento distingue **preparado**, **probado** y **funcionando**; no declarar completitud de la app antes de pruebas end-to-end.
