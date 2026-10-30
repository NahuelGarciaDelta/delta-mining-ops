# Delta Mining OPS V9 — Rama funcional de integración

**Rama:** `feature/v9-ops-supabase-app-20261030` (desde `migration/unified-apps-script-v9-20261029`).
**Producción:** `main` + Apps Script V8.1 siguen independientes y operativos.
**Estado:** Aplicación React/Vite con módulo V9 de lectura integrado. **No es todavía un cutover operativo**; el transporte V9 no escribe ni genera ACK reales.

## Estructura implementada

| Componente | Archivo | Comportamiento |
|---|---|---|
| Pantalla de control dentro de Delta OPS | `src/modules/v9/V9OpsPanel.jsx` | Estados de migración, 5295 tareas, búsqueda por estado y páginas de ROP05 |
| Navegación de la app | `src/App.jsx` | Botón desde Bienvenida y entrada «V9 · Piloto Supabase» para Admin/Oficina Técnica |
| Backend Vercel seguro | `api/v9-ops.js` | Requiere token técnico V9, nunca expone secreto Supabase al navegador, solo `preview` y `gas-health` |
| RPC de Supabase **ya instalado** | `supabase/v9_migration/20261030_v9_ops_readonly_rpc.sql` | `public.dm_v9_ops_read_v1`; solo `service_role`, los 15 campos originales siguen en esquema privado |
| Generador GAS 4F V3 | `integration/apps-script/v9/DM_UNIFIED_PHASE4B_ROP05_GENERADOR_NO_DESTRUCTIVO_V1.gs` | Código versionado, **IDs de hojas redactados**; únicamente generador/outbox en modo seguro |
| Pruebas ACK GAS 4I | `integration/apps-script/v9/DM_UNIFIED_PHASE4D_ACK_VERSION_SANDBOX_V1.gs` | Simulación de ACK con datos ficticios y previsualización; sin envíos reales |
| Verificación | `tests/v9-ops-proxy.test.mjs` y `tests/v9-gas-sources.test.mjs` | Acceso, lectura acotada, fuentes sin IDs privados |

## Cómo ejecutar el piloto local

```bash
git switch feature/v9-ops-supabase-app-20261030
npm ci
npm run dev
```

Para compilar: `npm run build`. La app existente sigue usando sus fuentes Supabase públicas autorizadas y su Apps Script V8.1 para autenticación/escrituras legadas.

El módulo V9 se abre desde el botón de **Bienvenida** (Admin/Oficina Técnica) o desde la barra lateral. No necesita recargar todos los datasets operativos para consultar el backend V9.

## Configuración privada en Vercel (solo en un Preview de esta rama)

Crear **en Vercel, no en GitHub**, como variables **no VITE_**, y restringirlas a esta rama concreta:

- `DELTA_V9_ADMIN_TOKEN`: token aleatorio de al menos 32 caracteres, exclusivo para técnicos autorizados; el usuario lo ingresa en la pantalla V9 y nunca se guarda en localStorage.
- `DELTA_V9_SUPABASE_URL`: URL HTTPS del proyecto productivo correcto de Delta Mining (el endpoint rechaza otro proyecto).
- `DELTA_V9_SUPABASE_SERVICE_KEY`: **clave privada de servidor** del mismo proyecto Supabase; nunca exponerla en `VITE_*`, Apps Script o frontend.
- `DELTA_V9_GAS_URL`: opcional, URL `https://script.google.com/macros/s/.../exec` del **clon** V9 de pruebas, no del Apps Script V8.1 productivo. Solo se consulta `action=health`.

**IMPORTANTE:** El repositorio es público. No configurar la clave `service_role` en TODOS los Preview o para PR de terceros. Utilizar un entorno protegido/restringido a esta rama revisada. Si no está configurada una credencial, el endpoint V9 responde 503 (falla cerrada). Nunca copiar claves en archivos `.env` commiteados, issues ni chats.

## Apps Script y Google Sheets

La copia del generador V9 en GitHub **NO es un reemplazo pegable tal cual** sin configurar 5 ScriptProperties de IDs productivos. Esto se hizo intencionalmente para evitar que un repositorio público revele identificadores de hojas:

`DM_V9_ROP05_BOOK_ID`, `DM_V9_ROP02_JM_BOOK_ID`, `DM_V9_ROP02_FS_BOOK_ID`, `DM_V9_PRODUCTION_GUARD_4_ID`, `DM_V9_PRODUCTION_GUARD_5_ID`.

Los archivos GAS que ya están instalados y probados en el clon **no fueron modificados** durante la creación de la rama. El botón «Verificar Apps Script V9» solo funcionará si existe una URL desplegada para ese clon y su `doGet` soporta `action=health`. La app normal continúa usando el script V8.1.

## Base de datos V9 realmente conectada

La RPC `public.dm_v9_ops_read_v1` consulta en vivo:

- `delta_v9.rop05_publication_live_gate_v1` para detectar desplazamiento de filas/bloqueos;
- `delta_v9.rop05_snapshot_read_v1` para mostrar productividad por ID estable;
- las tablas puente/revisiones/planes previamente implementadas sin habilitar las escrituras.

La base rechaza `publishing_enabled=true`; los ACK operativos continúan en cero. Las 34 filas desplazadas permanecen bloqueadas, al igual que los 23 registros sin identidad legacy, los 8 con productividad pendiente y el registro con anomalía numérica. **No se deben insertar/reubicar automáticamente a partir de la pantalla.**

## Pruebas y despliegue

- CI GitHub: [Validar piloto V9](https://github.com/NahuelGarciaDelta/delta-mining-ops/actions/workflows/v9-branch-validation.yml).
- La compilación con cambios React y API recibió al menos un resultado satisfactorio de «Predeploy Candidate Validation» en GitHub durante esta implementación; revisar siempre el commit más reciente antes de dar por validada toda la rama.
- El despliegue automático/manual de Preview en Vercel está **bloqueado por cuota diaria de deployments (HTTP 402)**. No hay URL de Preview verificada en esta entrega; no se modificó la producción.

## Pendientes para la sustitución operativa V9

1. Autenticación/sesiones del clon GAS y mecanismo de publicación V9 con identidad estable, revisiones remotas secuenciales y ACK real idempotente.
2. Lecturas y escrituras operativas completas desde la app, primero en canary reversible y sin modificar `main`.
3. Reconciliar desplazamientos de filas y datos en cuarentena sin falsos vínculos.
4. Reparar parser numérico y registro afectado con respaldo.
5. Definir política explícita de productividad **provisional vs. cerrada** y propagar correcciones tardías sin duplicaciones.

**Resumen:** La rama ya contiene una app real integrada con Supabase V9 y fuentes Apps Script V9 versionadas. No afirmar que el flujo V9 completo ya reemplaza V8.1.
