# Delta Mining OPS V9 — Rama ejecutable y prueba paralela

**Rama:** `feature/v9-ops-supabase-app-20261030`  
**Base:** `migration/unified-apps-script-v9-20261029`  
**Producción:** `main` y Apps Script V8.1 permanecen en servicio.  
**Preview Vercel:** https://delta-mining-ops-git-feature-v9-37ff09-delta-mining-s-projects.vercel.app

## Qué funciona

La aplicación React/Vite existente incorpora una nueva sección **V9 · Piloto Supabase**, disponible en la navegación y Bienvenida para administradores y Oficina Técnica. El frontend intenta reutilizar la sesión normal de Delta OPS y no pide otra contraseña. **Sin embargo, el puente de verificación todavía no está activado:** el Apps Script operativo emite tokens HMAC propios, mientras que Supabase valida tokens guardados en `app_user_sessions`. No deben considerarse intercambiables.

El RPC de lectura, los filtros y la paginación fueron probados con consultas SQL y mocks, y el frontend compiló en Vercel. **La consulta autenticada extremo a extremo desde un usuario V8.1 todavía no pasó**, porque falta el puente de sesiones. El diagnóstico `health` de Apps Script V9 solo funcionará cuando exista un despliegue de prueba configurado.

### Arquitectura real

```text
Usuario -> Login Delta OPS (existente)
        -> React src/App.jsx -> V9OpsPanel.jsx
        -> Vercel api/v9-ops.js (solo POST preview / gas-health)
        -> [BLOQUEADO: tokens firmados por Apps Script ≠ sesiones Supabase]
        -> Supabase PostgREST public.dm_v9_ops_session_read_v1
           -> Valida p_auth_token con public.app_require_session_
           -> Comprueba rol administrador / área Oficina Técnica
           -> public.dm_v9_ops_read_v1 [solo lectura]
           -> delta_v9 (plan, historial y compuerta de publicación)
```

Vercel **solo usa la clave pública `sb_publishable_...`** del proyecto para consultar el RPC que valida sesión y rol del lado servidor. Nunca utiliza ni devuelve una `service_role` o `sb_secret` para este panel.

La identidad de las tareas usa `task_key`, no el número físico de fila. Los cambios diferidos de productividad se conservan en el historial de revisiones sombra. Un desplazamiento o una diferencia posterior cambia la compuerta de publicación a bloqueado.

## Archivos de la rama

| Componente | Ubicación |
|---|---|
| Navegación y enrutamiento | `src/App.jsx` |
| Panel de datos V9 | `src/modules/v9/V9OpsPanel.jsx` |
| Proxy Vercel con sesión existente | `api/v9-ops.js` |
| RPC de lectura interna | `supabase/v9_migration/20261030_v9_ops_readonly_rpc.sql` |
| RPC de autenticación del piloto | `supabase/v9_migration/20261030_v9_existing_session_read_rpc.sql` |
| SQL de identidad/historial/publicación bloqueada | `supabase/v9_migration/` |
| Generador Apps Script V9 (fuente versionada) | `integration/apps-script/v9/DM_UNIFIED_PHASE4B_ROP05_GENERADOR_NO_DESTRUCTIVO_V1.gs` |
| Ensayos de ACK / vista previa V9 | `integration/apps-script/v9/DM_UNIFIED_PHASE4D_ACK_VERSION_SANDBOX_V1.gs` |
| Prueba de proxy y fuentes GAS | `tests/v9-ops-proxy.test.mjs`, `tests/v9-gas-sources.test.mjs` |
| Validación automatizada de rama | `.github/workflows/v9-branch-validation.yml` |

## Prueba del módulo

1. Entrar a la URL de Preview de Vercel, con autenticación Vercel si el proyecto la exige.
2. Iniciar sesión con el **usuario habitual** de Delta OPS.
3. Abrir **V9 · Piloto Supabase** desde la Bienvenida o la barra lateral.
4. Revisar el estado de las tareas ROP05 y sus bloqueos. El botón *Actualizar datos* vuelve a consultar la compuerta vigente.
5. El botón **Verificar Apps Script** responde “No configurado” hasta que exista un despliegue Web App V9 de pruebas y se informe su dirección mediante `DELTA_V9_GAS_URL` en el entorno Preview.

### Configuración

No instalar credenciales secretas de Supabase en Vercel: la validación ocurre en un RPC con sesión de Delta OPS. El proxy V9 usa la clave **pública** del proyecto, con valores por defecto del repositorio. Se pueden configurar `DELTA_V9_SUPABASE_URL` y `DELTA_V9_SUPABASE_PUBLISHABLE_KEY` como variables de Preview si se quiere sustituir estos valores.

La URL `DELTA_V9_GAS_URL` es opcional y debe corresponder **solo** al proyecto de prueba V9; no utilizar el Apps Script operativo para este diagnóstico. No configurar desencadenadores automáticos ni credenciales productivas de escritura.

```bash
git switch feature/v9-ops-supabase-app-20261030
npm ci
npm run validate
npm run build
```

## Protección de producción y límites actuales

- V8.1 sigue sincronizando las fuentes. `main` no se modificó y no hubo publicación V9.
- `delta_v9.rop05_publication_plan_v1` tiene los 5295 planes inicialmente bloqueados; las filas nuevas o desplazadas requieren reconciliación.
- La cola de recibos ACK operativos existe, pero **continúa vacía**.
- Los módulos de Apps Script integrados en GitHub son **fuentes versionadas, no un Web App desplegado**; V9 no puede usar su `health` hasta configurar y verificar el despliegue.
- Aún **no** hay reemplazo operativo de V8.1 ni escritura V9 de productividad. El objetivo siguiente es crear y probar ese transporte con identidad estable, revisiones y ACK bajo autorización separada.
- No abrir la función `dm_v9_ops_read_v1` a `anon`; únicamente `dm_v9_ops_session_read_v1` puede ser invocada con sesión vigente y rol habilitado.
- No confundir el build de Vercel con una prueba end-to-end autenticada. Hay pruebas unitarias y lectura SQL por separado; la comprobación final desde una sesión de usuario real aún debe completarse.


## Bloqueo de autenticación verificado (30/10/2026)

La tabla `public.app_user_sessions` tenía 28 sesiones históricas y **0 vigentes** al momento de la comprobación; la última fue creada el 14/10/2026. El login de `src/modules/auth/Login.jsx` consulta el action `authenticate_user` de Apps Script. El Apps Script firma su propio token con `stockExcelIssueAuthToken_` y `stockExcelAuthSecret_`, mientras que `public.app_require_session_` verifica el SHA-256 de otro token que debe existir en `app_user_sessions`. Por eso **un inicio de sesión correcto en V8.1 no basta para invocar hoy el RPC V9**.

Se preparó sin desplegar `integration/apps-script/v9/DM_V9_AUTH_BRIDGE_READONLY.gs`. Este archivo valida el token HMAC existente y su perfil activo **solo si se instala en el mismo proyecto de Apps Script que emitió el token**; una copia independiente carece del secreto y no puede verificarlo. No exponer ni copiar los secretos de `ScriptProperties` a GitHub ni al navegador. No alterar el despliegue activo V8.1.

El contrato para ese puente está **implementado en código, pero NO habilitado ni desplegado** en `api/v9-ops.js`:
1. Si están definidas `DELTA_V9_AUTH_BRIDGE_URL` y `DELTA_V9_SUPABASE_SERVICE_KEY` en el entorno **Preview de esta rama**, Vercel envía el token existente **solo** al nuevo action `v9_validate_existing_session` de una versión nueva del **mismo proyecto Apps Script** que emitió el token.
2. Apps Script verifica firma, vencimiento y estado de cuenta; el resultado debe ser `{ok:true,mode:"V9_SIGNED_SESSION_VALIDATED"}`. Un rechazo no tiene fallback.
3. Solo después de esa validación, Vercel invoca `dm_v9_ops_read_v1` de Supabase con una clave **servidor**; nunca se envía esa clave a React o a Apps Script. El RPC sigue siendo solo lectura y mantiene el plan de publicación V9 completamente bloqueado.
4. Si se configura solamente una de esas dos variables, el backend falla cerrado con `V9_AUTH_BRIDGE_INCOMPLETE`. No subir secretos a GitHub ni copiar la propiedad `APP_AUTH_TOKEN_SECRET`.

**Pendiente para activación:** instalar el archivo `DM_V9_AUTH_BRIDGE_READONLY.gs` en el proyecto Apps Script operativo **sin tocar la implementación activa V8.1**, agregar su acción a la nueva versión de `doPost`, crear una URL de Web App de prueba y configurar esas dos variables **restringidas a la rama Preview** en Vercel. Eso necesita revisión de permisos y un despliegue autorizado; no se ha realizado desde esta conversación.

El `dm_v9_ops_session_read_v1` ya instalado permanece como alternativa para sesiones de Supabase (no sirve para los tokens HMAC actuales). Las pruebas unitarias del proxy cubren el flujo fail-closed, pero todavía falta una prueba de usuario real desde la app.

**Estado de Vercel:** el primer Preview de código compiló y quedó READY (commit `e465ae80`). Los cambios posteriores de pruebas/documentación/diagnóstico no se redeplegaron porque Vercel devolvió el límite `api-deployments-free-per-day` (402); el Preview no debe anunciarse como build del último commit ni como flujo autenticado aprobado.

## Criterios para reemplazar V8.1

Antes de fusionar a `main`: validar los datos reales completos, resolver los registros en cuarentena, reparar el parser numérico legado de manera compatible, acordar productividad provisional/definitiva, implementar un escritor transaccional con idempotencia por `request_id`, verificar ACK versionado y ejecutar pruebas de rollback y de operación bajo carga. La vista previa no satisface aún estos requisitos.
