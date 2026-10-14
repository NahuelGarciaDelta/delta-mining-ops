# Instalación y recuperación del backend V9

**No se ejecutó ningún despliegue.** Esta guía describe acciones manuales para después de aprobar la prueba con copias.

## 1. Archivo exacto

Usar **`AppsScript_Delta_Mining_OPS_FINAL.txt`**, en la raíz del repositorio y del paquete ZIP. Es un archivo completo, UTF-8, de **287.664 bytes**, con **248 funciones globales**. No requiere otros archivos `.gs`, librerías externas ni el helper de integración para producción.

SHA-256 del archivo entregado y probado:

```text
6e53019c95dd52ec7422fdf3aa2aa799e6c9fad776719bbdc65e36522987c59a
```

Verificar localmente:

```bash
sha256sum AppsScript_Delta_Mining_OPS_FINAL.txt
```

En PowerShell:

```powershell
Get-FileHash .\AppsScript_Delta_Mining_OPS_FINAL.txt -Algorithm SHA256
```

Copiar todo el contenido, desde `var DELTA_BACKEND_VERSION_` hasta la última llave. No copiar bloques Markdown, informes, el archivo de copias ni partes sueltas.

## 2. Reemplazo del código

1. Exportar primero el código completo actual, `appsscript.json`, la configuración del proyecto, la versión publicada y los destinos de las implementaciones. Conservar backups de las planillas y las propiedades en un lugar privado; no pegar secretos en el chat, repositorio o ZIP.
2. Confirmar que el código publicado corresponde al original adjunto. La comparación de esta entrega cubre ese original, **no un proyecto remoto que no se inspeccionó**. Si hay `.gs` adicionales con funciones que no figuran en el adjunto, inventariarlos antes de borrar o reemplazar algo.
3. En el proyecto de Apps Script existente, reemplazar **todo el backend correspondiente al adjunto**, normalmente el contenido de `Code.gs`, por el archivo final completo. No pegar V9 al final de V8 ni mantener otra copia de las mismas funciones en un segundo `.gs`.
4. Conservar `appsscript.json`, la zona horaria, las propiedades, IDs de implementación y los triggers existentes. Activar/mantener el runtime **V8**. No cambiar la zona horaria ni configuración regional de Sheets como parte de esta corrección.
5. No instalar `IntegrationCopies.gs` ni `Code-COPIAS.txt` en producción. No ejecutar funciones de test sobre el proyecto publicado.

Se preservan las 231 funciones globales del original suministrado. Sus ocho cambios están documentados en [DIFERENCIAS.md](DIFERENCIAS.md).

## 3. Propiedades, permisos y secretos

**Producción:** no se necesita una clave nueva de Supabase ni una nueva dependencia. El backend usa ScriptProperties como antes.

- Conservar **`APP_AUTH_TOKEN_SECRET`**. V9 usa ese secreto para interpretar los nuevos hashes `dm-hmac-v1:` y firmar tokens. **No borrarlo, regenerarlo ni sustituirlo después de migrar una contraseña.** Su ausencia en un proyecto nuevo genera otro secreto; eso no hace compatibles hashes creados con un secreto anterior.
- Si en el proyecto actual aún no existe ese secreto y no hay contraseñas `dm-hmac-v1:`, el mecanismo heredado puede crearlo automáticamente. No hace falta publicar su valor.
- `DM_AUTH_*`, `DM_METER_OP_*`, `DM_LISTA_METER_DIRTY`, `DM_VERSION_*` y `DM_UPDATED_*` son estado gestionado por el backend. No rellenarlos manualmente ni borrarlos para resolver un timeout.
- La columna existente de contraseña admite valores heredados; una nueva contraseña se guarda como hash. No reemplazar los hashes por texto plano, ni pegar masivamente una copia antigua de Usuarios.
- La cuenta que ejecuta el web app debe conservar acceso a las planillas configuradas. El código existente también utiliza Drive para metadatos/caché y ScriptApp para triggers; si Google pide reautorizar, revisar los permisos del proyecto. La corrección no incorpora UrlFetch de Supabase al backend.
- El modo “ejecutar como” y el acceso del web app deben mantener el funcionamiento de la implementación actual y las políticas de la organización. Se desconocen los ajustes actuales; no puede asegurarse que todos los scopes o permisos ya estén aprobados. El frontend usa `/api/apps-script` desde el servidor y necesita recibir JSON, no una página de login de Google. Si la implementación exige sesión Google que el proxy no tiene, verificar esa arquitectura en staging antes de cambiar el acceso.

Los nombres `DELTA_TEST_*` y la clave de acceso de prueba son **sólo para un proyecto nuevo de copias**, no requisitos de producción.

## 4. Implementación existente o nueva

**Preferir actualizar la implementación existente en el mismo proyecto**, conservando sus propiedades y su URL `/exec`.

Después de aprobar staging: **Desplegar → Administrar implementaciones → seleccionar el web app vigente → Editar (lápiz) → Versión: Nueva versión → Implementar**. Guardar la nueva versión del código no actualiza por sí sola la versión publicada.

Así se mantiene la URL usada por:

- `api/apps-script.js`, constante `APPS_SCRIPT_TARGET`.
- `src/services/tallerMovements.js`, constante `DIRECT_APPS_SCRIPT_URL` de respaldo.

Crear una implementación nueva es una alternativa si se decidió cambiar la URL. En ese caso actualizar **ambos destinos** en un cambio de configuración revisado antes de publicar el frontend. `.env` con `VITE_APPS_SCRIPT_URL` no modifica esas constantes. Crear un **proyecto** nuevo también requiere preservar/migrar de manera segura el secreto si ya hay hashes; no confundir un proyecto nuevo con una nueva versión de implementación del mismo proyecto.

Para copias siempre usar un proyecto/implementación separado, según [INTEGRACION-COPIAS.md](INTEGRACION-COPIAS.md).

## 5. Supabase

No cambiar tablas, datos operativos, contraseñas, claves de Supabase ni RPCs de lectura. El frontend corregido deja de usar el RPC bcrypt independiente `app_authenticate_user`: login y cambio de contraseña usan Apps Script como autoridad común.

Después de migrar el frontend y cualquier otro cliente, revisar y aplicar manualmente:

```text
supabase/migrations/20261014_retire_legacy_auth_rpc.sql
```

La SQL identifica las firmas reales y revoca `EXECUTE` de ese RPC a `PUBLIC`, `anon` y `authenticated`. No elimina la función ni toca tablas o RPCs operativos. **No se ejecutó en esta tarea.** Si otros clientes aún dependen de ella, migrarlos primero. No restaurar su acceso como solución al cambio de contraseña: podría volver a aceptar una contraseña vieja del espejo independiente.

Comprobación de permisos en el SQL Editor, de lectura:

```sql
SELECT p.oid::regprocedure AS firma,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_puede_ejecutar,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_puede_ejecutar
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'app_authenticate_user'
  AND p.prokind = 'f';
```

Ambos permisos deberían quedar en `false`, incluyendo permisos heredados. Verificar con el administrador los demás roles y consumidores; `service_role` no se modifica por esta migración.

## 6. Orden de publicación

1. Revisar la rama y el commit entregados. Ejecutar las validaciones locales.
2. Ejecutar la integración en copias, incluido HTTP y el frontend de staging; resolver todo fallo o pendiente. La preparación del kit no cuenta como prueba real aprobada.
3. Planificar una ventana de actualización para evitar clientes mezclados.
4. Publicar **Apps Script V9 primero**, actualizando la implementación vigente. Verificar versión y acceso JSON.
5. Publicar el **frontend corregido** del mismo commit. Recargar las pestañas/iniciar sesión. Los clientes antiguos de cambio de perfil y bulk serán rechazados antes de escribir; no deben seguir operando en paralelo.
6. Retirar el acceso público al RPC bcrypt antiguo en Supabase **después** de migrar los clientes, con aprobación del administrador.
7. Verificar comportamiento y Egress. No hay una medición real de los 120–130 MB/día en esta entrega.

Los cambios que afectan producción requieren autorización independiente. Ninguno de estos pasos se ejecutó aquí.

## 7. Cómo comprobar V9

Hacer un GET de lectura al `/exec` publicado con `?action=backend_version`. La respuesta debe ser JSON con `ok:true` y:

```json
{
  "version": "2026-10-14-AUTH-METER-INTEGRITY-V9",
  "backendVersion": "2026-10-14-AUTH-METER-INTEGRITY-V9"
}
```

Los otros campos de la respuesta pueden seguir presentes. Verificar también la ruta `/api/apps-script?action=backend_version` del frontend desplegado: ambas versiones deben coincidir.

En staging, `authenticate_user` debe devolver usuario, token, `mustChangePassword` y:

```json
{
  "capabilities": {
    "passwordHashProfile": true,
    "meterCellWrites": true
  }
}
```

Tras un cambio confirmado, el login con la contraseña nueva debe dar `mustChangePassword:false`, y la anterior debe devolver `AUTH_INVALID`. No publicar respuestas con tokens ni contraseñas en logs o capturas.

La consulta de versión identifica la versión anunciada por el servicio, **no mide el SHA-256 del código remoto**. La huella local y el commit prueban el archivo entregado; el código remoto debe inspeccionarse/exportarse para demostrar igualdad byte por byte. No se hizo esa inspección remota.

## 8. Si algo falla

- **Timeout o respuesta perdida:** conservar el mismo `operationId`, contenido y actor. Verificar esa operación y reintentar idempotentemente; no crear un ID nuevo ni volver a mandar el lote completo mediante edición general. `pending` significa que no se confirmó un fallo de escritura.
- **Resultado parcial:** atender los equipos identificados como fallidos. Los confirmados tienen recibos; no necesitan reescritura. Un conflicto exige releer la celda y decidir sobre el valor actual.
- **Sincronización de autenticación pendiente:** no borrar el espejo ni la clave. La marca `DIRTY` fuerza leer la fila canónica; comprobar el acceso con la contraseña nueva. Conservar el mismo pedido de perfil para recuperar su confirmación.
- **Permisos o conexión:** detener nuevas escrituras, corregir acceso o la URL, y volver a verificar. No sustituir respuestas por éxitos artificiales.
- **Fallo del frontend:** mantener Apps Script V9, las celdas y ScriptProperties intactos; recuperar una versión compatible del frontend o corregirla. No regresar al login Supabase independiente ni a un backend que trate los hashes como texto plano.
- **Fallo del backend nuevo:** conservar hashes y `APP_AUTH_TOKEN_SECRET`, restringir temporalmente las escrituras si es necesario y aplicar una corrección compatible en el mismo proyecto. Reinstalar el mismo archivo V9 probado es seguro respecto de conservar las propiedades; restaurar V8 sobre usuarios migrados **no lo es**.
- **Daño anterior en CTA-0530:** V9 evita nuevas reescrituras, pero no reconstruye automáticamente fórmulas o datos perdidos antes. Usar backups/historial para comparar y autorizar reparación de celdas concretas; no restaurar filas o tablas completas a ciegas.

Los recibos de lectura duran 24 horas y se limita su capacidad reciente. El ScriptLock coordina las solicitudes de la app, no a usuarios que editan/ordenan Sheets manualmente. Mantener la planilla protegida y sin ediciones manuales simultáneas durante un lote. Estos límites requieren revisión con el volumen real antes de producción.
