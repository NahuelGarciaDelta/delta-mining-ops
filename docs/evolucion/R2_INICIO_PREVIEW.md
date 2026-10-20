# EVOLUCIÓN DE DELTA OPS — Cloudflare R2 · Guía de puesta en marcha (solo Preview)

> Base: `main` commit `2f3a71c2feb0826629fcaff4f87c20e98205188b`, 20-10-2026. 
> Rama exclusiva: `evolucion-de-delta-ops`. PROHIBIDO fusionar a `main` o promover a producción sin autorización.
> Repositorio de GitHub **público**: jamás subir Access Key, Secret Key, tokens de Apps Script, claves de servicio, documentos personales ni un archivo `.env` real.

## Alcance y decisiones

- **Primer piloto:** solamente documentación técnica NO sensible de equipos. No cargar legajos, DNI, certificados de salud, estudios médicos, pólizas reales confidenciales, ni documentación de personas en el piloto.
- **R2:** bucket privado exclusivo de Preview, `delta-ops-documentos-preview`, clase `Standard`; el contenido no será público (`r2.dev` y dominios públicos desactivados).
- **Metadatos:** tabla documental aislada del ROP02/ROP05/RMA15. Nunca guardar PDFs o imágenes como `bytea` en la base operativa. No crear tablas nuevas en Supabase productivo hasta decidir entorno de pruebas aislado y permisos.
- **Autenticación:** actual DELTA OPS usa sesión emitida por Apps Script V9; un permiso del navegador o `sessionStorage` no es suficiente. El servidor que emita enlaces temporales **debe verificar token y rol con la autoridad de sesión V9**. Si esa comprobación no existe, API cerrada por defecto; nada de firmar URLs para usuarios no autenticados.
- **Transferencia:** browser `PUT` directo a R2 mediante URL presignada con TTL corto (ej. 60 s), MIME firmado; nunca enviar el archivo binario por `/api/apps-script` ni por función Vercel. Confirmar resultado con HEAD/metadata antes de marcar archivo disponible.
- **Seguridad:** validar extensión y contenido (magic bytes), límites de tamaño, control malware para documentos de terceros, UUID para nombres internos, permisos por documento/categoría, auditoría de accesos, permisos privados sin ACL pública, eliminaciones lógicas y respaldos.
- **Aislamiento:** el código de la rama no afecta `main`. Las páginas Preview aún podrían usar la base *productiva* si heredan las variables de su proyecto Vercel; las escrituras del módulo documental deben permanecer DESHABILITADAS hasta contar con un entorno aislado y credenciales Preview específicas.

## Paso 1. Cloudflare: crear espacio de pruebas

1. Entrar a https://dash.cloudflare.com/ con una cuenta bajo titularidad corporativa de DELTA MINING, no una cuenta personal.
2. Abrir **Storage & databases → R2 → Overview**. Si es primer uso, activar R2 y completar el alta de facturación que muestre Cloudflare (el uso gratuito tiene cuotas; la cuenta puede exigir medio de pago).
3. Pulsar **Create bucket**, nombre: `delta-ops-documentos-preview`, clase **Standard**. Ubicación automática salvo requisito corporativo o regulatorio distinto.
4. Mantener el bucket **privado**; no activar URL `r2.dev` pública ni dominio personalizado público.
5. En R2, localizar **Account ID** (identificador no secreto). Guardarlo para configurar Vercel.

## Paso 2. Generar credenciales S3 SOLO para ese bucket

1. R2 → **Manage R2 API tokens** (o Account Details → API Tokens → Manage) → Create Account API token.
2. Permiso: **Object Read & Write** y limitar el token **únicamente** a `delta-ops-documentos-preview`. Nunca permiso global de administrador.
3. Copiar una sola vez el **Access Key ID** y **Secret Access Key** a un gestor seguro de credenciales corporativas. No pegarlos en ChatGPT, tickets, GitHub, capturas ni archivos públicos.
4. Endpoint S3 compatible: `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`.

## Paso 3. Preview en Vercel (requiere reautenticación del equipo)

- Equipo esperado: `team_rlupPWiJME09UrhetfmRucOr`, slug `delta-mining-s-projects`.
- La conexión automatizada del equipo devolvió **403**, por lo que los secretos y el proyecto Preview deben configurarse desde https://vercel.com/ o reautorizando Vercel a ese scope.
- No usar `delta-mining-ops.vercel.app` ni modificar su entorno **Production**.
- Opción recomendada: crear un proyecto separado `delta-mining-ops-evolucion-preview` conectado al repo `NahuelGarciaDelta/delta-mining-ops` y limitar el trabajo a la rama `evolucion-de-delta-ops`. **Importante:** un proyecto Vercel separado puede crear un despliegue *Production* de ese proyecto por defecto; eso NO equivale a un Preview. Para exigir únicamente despliegues Preview, conservar `main` como production branch en el proyecto productivo y usar la rama de evolución como Preview, o configurar un proyecto adicional con reglas explícitas antes de desplegar.
- En **Project Settings → Environment Variables** del proyecto Vercel autorizado, crear estas variables **solo con Target: Preview**, y, de ser posible, scope **Git Branch: `evolucion-de-delta-ops`**:

```ini
R2_ACCOUNT_ID=<ID de cuenta, no es contraseña>
R2_BUCKET_NAME=delta-ops-documentos-preview
R2_ACCESS_KEY_ID=<Access Key de R2>
R2_SECRET_ACCESS_KEY=<Secret Access Key de R2>
DOCUMENTOS_STORAGE_ENABLED=false
```

- Las claves R2 deben ser de tipo **Sensitive/Encrypted** según las opciones del proyecto. No anteponer `VITE_` a claves porque Vite las expondría en el navegador.
- `DOCUMENTOS_STORAGE_ENABLED` debe permanecer `false` hasta pasar verificaciones de identidad, roles y almacenamiento.

## Paso 4. CORS del bucket (después de obtener URL real de Preview)

Editar la política CORS del bucket de R2 en **Settings → CORS policy**. Reemplazar `https://TU-PREVIEW-REAL.vercel.app` con el origen HTTPS exacto del Preview, sin barra final. No habilitar `*` para documentos privados.

```json
[
  {
    "AllowedOrigins": ["https://TU-PREVIEW-REAL.vercel.app"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

La política CORS **no es autenticación**; la autorización real se hace en el servidor antes de emitir URLs firmadas, y las URLs firmadas se usan solo con TTL corto.

## Paso 5. Contrato de implementación (siguiente iteración)

1. Validar en el servidor el token de sesión V9 y rol autorizado sin confiar en email o rol del cliente.
2. Inicialmente soportar *solo* PDF/JPG/PNG de equipos de prueba, tamaño máximo 10 MB, sin datos personales.
3. Servidor: `POST /api/documentos/solicitar-subida` → identidad + rol + MIME + tamaño → `objectKey` aleatorio `preview/equipos/<equipo>/<uuid>` y URL presignada TTL 60 s.
4. Browser: enviar contenido con `PUT` directo a R2, reportar progreso e informar error real en cada etapa.
5. Servidor: `POST /api/documentos/confirmar-subida` → verificar archivo R2 (HEAD/checksum/tamaño), actualizar catálogo de metadatos aislado. Sin confirmación, la carga permanece **pendiente** y no aparece como completada.
6. Descargas mediante `GET` firmado de corta duración luego de verificar permisos; jamás URLs públicas persistentes.
7. Lista de documentos por equipo, filtros, vencimiento, versiones, auditoría, manejo de virus, límites por usuario y alertas.
8. Ejecutar pruebas con archivos ficticios de 100 KB, 2 MB y 9 MB, tipos inválidos, cortes de red y sesión expirada, y revisar tráfico, costos y tiempo.
9. Recién después de comprobar Backup, RLS/roles, recuperación y observabilidad, habilitar datos reales de equipos. Legajos y salud quedan en una segunda etapa con permisos especiales.

## Referencias oficiales

- https://developers.cloudflare.com/r2/get-started/
- https://developers.cloudflare.com/r2/api/tokens/
- https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/
- https://developers.cloudflare.com/r2/pricing/
- https://vercel.com/docs/git

**Estado:** rama GitHub creada. Configuración real Cloudflare R2 y Vercel pendiente de la persona propietaria de sus cuentas; no hay bucket, token, API de subida ni prueba de almacenamiento confirmados. El repo puede estar público.
