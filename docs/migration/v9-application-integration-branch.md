# Delta Mining OPS V9 — Rama ejecutable y prueba paralela

**Rama:** `feature/v9-ops-supabase-app-20261030`  
**Base:** `migration/unified-apps-script-v9-20261029`  
**Producción:** `main` y Apps Script V8.1 permanecen en servicio.  
**Preview Vercel:** https://delta-mining-ops-git-feature-v9-37ff09-delta-mining-s-projects.vercel.app

## Qué funciona

La aplicación React/Vite existente incorpora una nueva sección **V9 · Piloto Supabase**, disponible en la navegación y Bienvenida para usuarios con perfil administrador u Oficina Técnica. El acceso **reutiliza la sesión normal de Delta OPS**; no pide otra contraseña ni requiere una clave de servicio Supabase en el navegador o en Vercel.

El panel puede consultar con paginación la conciliación ROP05 sobre `delta_v9`, filtrar los motivos de bloqueo y mostrar tareas, horas y productividad desde la lectura por `task_key`. Cuenta con acceso a un diagnóstico `health` del Apps Script V9 de pruebas **solo cuando esté configurada su URL**.

### Arquitectura real

```text
Usuario -> Login Delta OPS (existente)
        -> React src/App.jsx -> V9OpsPanel.jsx
        -> Vercel api/v9-ops.js (solo POST preview / gas-health)
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

## Criterios para reemplazar V8.1

Antes de fusionar a `main`: validar los datos reales completos, resolver los registros en cuarentena, reparar el parser numérico legado de manera compatible, acordar productividad provisional/definitiva, implementar un escritor transaccional con idempotencia por `request_id`, verificar ACK versionado y ejecutar pruebas de rollback y de operación bajo carga. La vista previa no satisface aún estos requisitos.
