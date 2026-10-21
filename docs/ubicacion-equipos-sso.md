# DELTA GEO integrado en DELTA Mining OPS — SSO de prueba

## Alcance
- Esta integración vive en la rama `feature/ubicacion-equipos-delta-geo`.
- La pantalla de bienvenida muestra ocho áreas en cuatro columnas por dos filas en escritorio.
- El módulo `Ubicación equipos` inserta un mapa aislado en un iframe con `sandbox`. La credencial de OPS nunca se transmite al iframe.
- El sistema no acepta una dirección de correo enviada por el navegador como prueba de identidad: exige un token OPS firmado y vigente.
- El servicio Supabase `ops-geo-sso` sólo genera un token de un uso si coincide el email verificado del token OPS con una cuenta Supabase Auth previamente confirmada y autorizada en `geo_miembros`.

## Habilitar el intercambio de sesión (requiere administrador)
1. En el proyecto real de **Google Apps Script** que emite los tokens de ingreso a OPS, abrir **Configuración del proyecto → Propiedades de secuencia de comandos**. Buscar `APP_AUTH_TOKEN_SECRET`. **No cambiar su valor**, porque las sesiones OPS existentes dependen de él.
2. En Supabase del proyecto `jwfocqaxlckuxoklwyxs`, abrir **Edge Functions → Secrets**. Crear `OPS_AUTH_TOKEN_SECRET` con exactamente el mismo valor que `APP_AUTH_TOKEN_SECRET` del Apps Script.
3. No incluir esa clave en GitHub, Vercel, capturas ni chats. El servicio la lee sólo de los secretos del servidor.
4. Verificar en `geo_miembros` que el usuario de GEO esté activo. Debe existir una cuenta Supabase Auth con email confirmado. No se habilita automáticamente a usuarios de OPS que no tengan autorización GEO.
5. Abrir el preview de la rama en su **alias estable**: `https://delta-mining-ops-git-feature-ubi-cb32b0-delta-mining-s-projects.vercel.app`. Entrar a OPS, luego a **Ubicación equipos**. El mapa debe mostrar "Sesión verificada" sin pedir contraseña.
6. Verificar que un token inválido o caducado no permita acceso y que una cuenta no habilitada en GEO sea rechazada.

## Restricciones y seguridad
- Sin el secreto configurado el servicio devuelve `503 SSO_NOT_CONFIGURED` **sin conceder acceso**. Éste es el estado actual.
- El inicio de sesión único no se habilita rellenando la contraseña de GEO en JavaScript, habilitando las tablas de GEO para `anon` ni quitando RLS.
- El intercambio se ejecuta sólo al abrir la sección. No hay un temporizador de sincronización de equipos; por tanto, no agrega descargas periódicas en Supabase.
- OPS producción (`main`) y el GEO independiente no se modifican al probar esta rama.
