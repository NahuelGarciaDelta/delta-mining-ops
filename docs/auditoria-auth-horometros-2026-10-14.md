# Auditoría de autenticación y horómetros — 14/10/2026

Estado: cambios locales para revisión en `fix/auth-and-horometer-integrity`. No se hizo push, merge, despliegue, ejecución de SQL ni escritura sobre datos reales.

## 1. Causas raíz verificadas

- **Reescritura de equipos:** `handleBulkUpdateListaEquiposFromApp_` llamaba a `handleUpdateListaEquipo_`. Esta última leía toda la fila con `getValues`, cambiaba `HORAS` en una copia y ejecutaba `getRange(fila, 1, 1, lastCol).setValues`. Por eso incluso un payload con un solo campo reescribía todas las celdas y podía sustituir fórmulas por sus valores calculados.
- **Identificación insegura:** la búsqueda general recorría todas las columnas, incluyendo modelo y valores ajenos al identificador, y elegía la primera coincidencia. No detectaba códigos duplicados ni exigía que Drusila y código nuevo identificaran la misma fila.
- **Falso error:** el bulk devolvía `ok:false` ante cualquier fallo individual. `postToAppsScript` lanzaba un error genérico antes de mostrar los equipos ya guardados. Una respuesta HTTP perdida tampoco permitía distinguir una escritura realizada de una escritura fallida.
- **Contraseña y espejos:** el backend adjunto guardaba la contraseña en texto plano y ocultaba las excepciones de `refreshAuthMirror_`. El frontend autenticaba primero con un RPC bcrypt de Supabase, sin contrato de sincronización con el cambio realizado en Sheets. Podían coexistir contraseñas e indicadores de primer ingreso diferentes.
- **Sesión y apariencia:** la actualización sólo cambiaba nombre y área del usuario persistido; no aplicaba una respuesta completa con token e indicador confirmado. Luego esperaba guardar apariencia central dentro del mismo `try`, convirtiendo un fallo de apariencia en un error de configuración tras una contraseña ya guardada.
- **Confirmaciones sintéticas:** el guard global podía devolver `{ok:true}` sin usuario/token ni resultados por equipo, o bloquear la comprobación de una operación pendiente.
- **Auditoría adicional:** `fetchSpecialAction_` invocaba `versionsDiffer_`, que no existía. Se implementó la comparación limitada a las versiones de las fuentes del resultado cacheado; cambios en fuentes ajenas no disparan invalidaciones. El test de concurrencia también usaba `setImmediate` sin importarlo para ESLint.

El diagnóstico de backend se hizo sobre el texto adjunto. El archivo `AppsScript_Delta_Mining_OPS_ROP02_OK.txt` del checkout es una versión anterior sin el espejo adjunto. Se incorporó el backend completo corregido como `AppsScript_Delta_Mining_OPS_FINAL.txt`, que ya era la ruta vigente declarada por README.

## 2. Archivos modificados o agregados

| Grupo | Archivos |
| --- | --- |
| Backend vigente | `AppsScript_Delta_Mining_OPS_FINAL.txt` — adjunto completo más las correcciones puntuales |
| Login y sesión | `src/modules/auth/Login.jsx`, `src/components/UserSettingsModal.jsx`, `src/services/authSession.js`, `src/services/profileUpdates.js` |
| Horómetros y transporte | `src/services/confirmedWrites.js`, `src/services/horometerUpdates.js`, `src/services/writeActions.js`, `src/services/mutationGuard.js` |
| Estado y pantalla | `src/App.jsx`, `src/modules/oficina-tecnica/OficinaTecnicaModule.jsx` |
| Comparación de versiones | `src/data/historicalDataService.js`, `src/data/historicalVersionPolicy.js` |
| Pruebas nuevas | `tests/horometer-integrity.test.mjs`, `tests/password-change-integrity.test.mjs`, `tests/confirmed-write-flows.test.mjs`, `tests/helpers/appsScriptHarness.mjs`, los dos inventarios JSON en `tests/fixtures/` |
| Contratos existentes | `tests/auth-fast-login-regression.test.mjs`, `tests/gerente-profile.test.mjs`, `tests/stock-validation.test.mjs`, `tests/historical-data-service.test.mjs`, `tests/supabase-request-concurrency.test.mjs` |
| Navegador y retiro del RPC | `scripts/audit-browser-integrity.mjs`, `supabase/migrations/20261014_retire_legacy_auth_rpc.sql` |
| Documentación | este informe, `README.md`, `CHANGELOG.md` |

Los contratos existentes se adaptaron al cambio de autoridad y a los nombres nuevos de variables. El contrato de Stock sólo recibió una corrección para aceptar espacios en la declaración que ya tenía el adjunto. No se deshabilitaron pruebas. Manifiestos de dependencias y lockfile no cambiaron.

## 3. Funciones y contratos corregidos

**Backend:** `handleAuthenticateUser_`, `handleUpdateUserProfile_`, `refreshAuthMirror_`, `getAuthMirrorUser_`, `findUsuarioRowByEmail_`, `handleBulkUpdateListaEquiposFromApp_`, `handleUpdateListaEquipo_` y el despacho de `doPost`.

**Nueva operación:** `handleListaHorometros_(payload, verifyOnly)`, con identificación exacta, validación de campos, control de valor esperado, revalidación de códigos en la fila real, bloqueo compartido y comprobación de persistencia. Admite `update_lista_horometros` y `verify_lista_horometros`. Cada actualización sólo contiene `identity`, `value` y `expectedValue`; no admite objetos completos de equipo, números de fila ni otras columnas. Requiere una sesión válida y conserva los permisos de Taller Central/Oficina Técnica y administración.

El frontend envía lotes de hasta 100 lecturas. El identificador de operación y su contenido se conservan al reintentar. Los recibos de cada lectura se guardan antes de escribir y confirman el resultado después. Una respuesta perdida provoca una consulta de verificación de esa operación; no una descarga de tablas. Estados: `complete`, `partial`, `failed` y `pending`, más un resultado individual por equipo. Si un recibo confirmado se repite, se devuelve el resultado original y se lee la celda actual para evitar aplicar un valor visual ya superado por otro usuario.

Sólo se invalida la versión de `lista_equipos`, una vez por lote escrito. Una falla de esa invalidación deja una marca pendiente y un aviso explícito; volver a verificar repara la versión sin reescribir lecturas. No se limpia la caché global.

Los recibos de horómetros tienen retención de 24 horas y un límite conservador de aproximadamente 500 entradas recientes (un último lote puede excederlo). Al llegar a capacidad se rechazan nuevos lotes antes de escribir; revisar este límite y las cuotas de ScriptProperties con el volumen real antes de habilitar cargas muy grandes. Los cambios manuales de Sheets no respetan `ScriptLock`: se verifica la identidad inmediatamente antes de escribir, pero Google Sheets no ofrece una transacción CAS que bloquee ediciones manuales en la ventana final. Para la garantía operativa completa, proteger las columnas y evitar ordenamientos/ediciones manuales simultáneos durante un lote.

**Autenticación:** el login de la aplicación usa el backend que escribe la contraseña. El espejo normal evita leer Sheets en cada acceso. Una marca de usuario inválida se guarda antes de cambiar la contraseña; si falla la sincronización, el login consulta la fila canónica y nunca acepta el hash anterior. La sincronización se hace sobre ese usuario, sin reconstruir todos los usuarios durante el cambio. Los espejos de la versión anterior se reconocen y actualizan antes de confiar en `mustChangePassword`.

Las nuevas contraseñas se guardan como `dm-hmac-v1:<hash>` en la columna existente, usando el HMAC del backend. Se mantienen compatibles las contraseñas heredadas para autenticar y se migran al cambiar la contraseña. Tanto vacío como `DELTA.MINING.APP` obligan a crear una contraseña personal. No se agrega almacenamiento de contraseñas en texto plano ni se guardan contraseñas en localStorage/sessionStorage. No se deben borrar o rotar las ScriptProperties que contienen el secreto de autenticación: los hashes dependen de ese secreto.

El cambio de perfil tiene un identificador idempotente y confirma sus celdas, devuelve la sesión completa y declara `authSync:"pending"` si el espejo aún no pudo persistirse. El cliente guarda el token y el indicador confirmados, separa la apariencia y descarta respuestas de una sesión que ya cambió. Los clientes nuevos exigen capacidades del backend actualizado antes de cambiar una contraseña.

## 4. Caso CTA-0530

La ruta antigua de horómetros **reescribía una fila existente**. No hay `appendRow` ni inserción en ese recorrido; el código revisado no demuestra que se estuviera insertando una fila duplicada. Sin acceso a la planilla y su historial no se puede afirmar qué ocurrió físicamente en producción ni si ya existen duplicados.

La prueba usa un mock con los datos conocidos: `CTA-0530`, `AF479QX`, Camioneta con mochila, TOYOTA, HILUX, FARO, serie `8AJKA3CD8R3125053`, lectura `99879` y proyecto `JOSE MARIA BATIDERO`. Se agregan columnas representativas de costos, potencia, fechas, combustible, capacidades y parámetros; esos valores adicionales son datos sintéticos, no una copia de valores desconocidos de producción.

Se guardan todos los valores y metadatos antes de cambiar `HORAS` a `99900`. Se compara el estado completo después. Sólo se observa una escritura `setValue` en fila 2, columna 8, rango 1×1. Se conservan las otras celdas, la fórmula de costo, formatos, validaciones y notas. El número de filas no aumenta. Las pruebas adicionales rechazan códigos duplicados, identificadores contradictorios, coincidencias en modelo, datos antiguos y fórmulas dentro de la propia celda de lectura.

## 5. Evidencia contra reescrituras completas

`handleListaHorometros_` no llama a la función general, `setValues`, `appendRow`, `insertRow`, a una sincronización de Supabase ni a `clearAllCache_`. El mock rechaza cualquier `setValues`: la prueba fallaría si se intentara escribir una fila completa. También comprueba que sólo se leen columnas de identificación y celdas individuales, salvo la fila de encabezados.

La edición explícita de equipos sigue separada y puede cambiar varios campos, pero ahora escribe únicamente las celdas solicitadas que cambiaron. No vuelve a pegar las columnas restantes.

Hay pruebas de inventario para las **231 funciones originales** del adjunto. Se conservan todas; los cuerpos de las **223 funciones ajenas a esta corrección** conservan su SHA-256 original. Esto prueba conservación del código, no equivalencia de todo comportamiento posible en servicios reales.

## 6. Pruebas y resultados

Resultados de la última ejecución: **371 pruebas aprobadas, 0 fallidas, 0 omitidas** en `npm run validate`. Incluye auditoría de seguridad, imports locales, sintaxis y toda la suite existente. Las pruebas específicas cubren primer ingreso, contraseña nueva/anterior, espejo fallido, idempotencia, timeout tras escritura, resultados parciales, conflictos, códigos duplicados, filas reordenadas, metadata y sesiones cerradas mientras llegaba una respuesta.

`npm run lint`: aprobado, con 823 advertencias existentes. Se corrigieron los cuatro errores que aparecían en la preparación del entorno. No se ejecutó `--fix` sobre módulos ajenos.

`node scripts/audit-browser-integrity.mjs`: aprobado en Chromium con Node 24. Primer ingreso, modal obligatorio, nueva sesión y recarga comprobados; una escritura de contraseña y ninguna excepción sin manejar. Todas las solicitudes externas están interceptadas y los handlers de autenticación se ejecutan contra el mock. El script levanta su propio Vite/Chromium y los cierra al terminar. Requiere Node 22 o superior y Chromium (`CHROME_BIN` permite elegir el ejecutable).

`node --input-type=commonjs --check < AppsScript_Delta_Mining_OPS_FINAL.txt` y `git diff --check`: aprobados.

`npm run format:check`: falla por **229 archivos existentes** con estilo pendiente, igual que la línea base. Los archivos nuevos JavaScript y las pruebas nuevas fueron formateados. No se reformateó todo el repositorio.

La migración SQL se comprobó por su alcance en un test, pero **no se ejecutó en PostgreSQL/Supabase**.

## 7. Pendientes y límites

- Verificar el despliegue real de Apps Script, sus permisos, cuotas, secreto persistido y las columnas reales de las planillas. No se validaron credenciales ni datos reales, y no se hicieron pruebas destructivas.
- Verificar cambios de contraseña y horómetros en una **copia** de las planillas con el backend nuevo antes de habilitar producción. Probar los tiempos de ejecución y el tamaño del lote con el volumen real.
- Revisar los permisos y consumidores del antiguo RPC `app_authenticate_user` y aplicar su retiro después de migrar clientes. La app corregida ya no lo usa; el RPC todavía podría validar una contraseña vieja fuera de esta app si queda accesible. No se declara corregido ese acceso externo hasta aplicar y verificar los permisos.
- Proteger las columnas contra ediciones/ordenamientos manuales simultáneos; el lock del script controla las solicitudes de aplicación, no la interfaz de Sheets.
- Prettier mantiene los 229 archivos pendientes y ESLint mantiene advertencias. El build conserva el aviso anterior del plugin `progressive-rows`: no se encontró el patrón `footer remitos`; no impide compilar.
- La SQL y el comportamiento del backend desplegado no están verificados en un servicio real. La meta de Egress diario no fue medida.

## 8. Build

`npm run build`: aprobado con Vite 5.4.14. Se generó `dist`, que sigue ignorado por Git. No se modificaron dependencias, lockfile ni reglas de negocio de ROP02, ROP05 o RMA15.

## 9. Supabase y Egress

Las consultas operativas, filtros, límites de concurrencia, deduplicación y RPCs de lectura existentes permanecen. El cambio de contraseña y la confirmación de horómetros realizan **cero consultas a Supabase**. El login deja de llamar al RPC bcrypt independiente. Una confirmación actualiza estado y caché local de las celdas confirmadas, sin `onReloadLista`, polling adicional ni recarga global.

Para N cambios, el envío normal usa `ceil(N/100)` solicitudes a Apps Script; una respuesta perdida añade una verificación de ese mismo lote. No se introducen verificaciones masivas para una sola lectura. Estas propiedades se comprobaron con requests simuladas; no son una medición de los 120–130 MB/día en producción.

## 10. Revisión y despliegue posterior

1. Revisar el diff de la rama, este informe y el backend completo. El archivo antiguo `AppsScript_Delta_Mining_OPS_ROP02_OK.txt` no debe desplegarse sobre la nueva versión de hashes.
2. Preparar una copia de las planillas y un despliegue de prueba de Apps Script con `AppsScript_Delta_Mining_OPS_FINAL.txt` completo. Configurar las rutas de esa copia; `VITE_APPS_SCRIPT_URL` por sí sola no cambia los destinos actuales de los handlers `/api/apps-script` y `/api/supabase-read`.
3. Ejecutar `npm ci`, `npm run validate`, `npm run lint`, `npm run build` y, con Chromium disponible, `node scripts/audit-browser-integrity.mjs`. Comprobar después en la copia los casos de concurrencia, sesión y CTA-0530. Los tests de navegador del repositorio usan mocks, no la copia real.
4. Con aprobación de despliegue, publicar **primero el backend V9**, comprobar `backend_version` y sus capacidades de autenticación; después publicar el frontend. Los clientes antiguos de actualización masiva serán rechazados antes de escribir. Pedir recarga/inicio de sesión para no mezclar versiones.
5. Con aprobación del administrador de Supabase y después de migrar clientes, aplicar manualmente `supabase/migrations/20261014_retire_legacy_auth_rpc.sql`. La migración descubre las firmas reales y revoca sólo el permiso de ejecución público/cliente de ese RPC; no altera tablas, datos, contraseñas ni los RPCs operativos. Revisar herencia de roles/permisos y comprobar que una llamada de cliente al RPC antiguo sea rechazada.
6. Verificar de forma no destructiva la nueva sesión y medir Egress con las herramientas del proyecto. No restaurar el backend antiguo sobre contraseñas ya migradas a hash; conservar el secreto y usar una corrección compatible en caso de incidencia.

No se hizo ninguna de las publicaciones ni ejecuciones de producción indicadas arriba.

## Entrega verificable posterior

La entrega final agrega comparación AST, checksum y kit de copias. La última validación completa aprobó **384 pruebas** (las 371 anteriores más 13 de entrega/compatibilidad), sin fallos ni omisiones. El archivo GAS canónico no cambió durante esta entrega y conserva SHA-256 `6e53019c95dd52ec7422fdf3aa2aa799e6c9fad776719bbdc65e36522987c59a`. Se corrigió además el reconocimiento de alias equivalentes que el adaptador Supabase agrega al frontend.

El informe de validación final es [docs/entrega-v9/VALIDACION.md](entrega-v9/VALIDACION.md); instalación e integración real pendiente están en ese mismo directorio. Los números anteriores corresponden a la auditoría previa, no a una prueba remota de producción.
