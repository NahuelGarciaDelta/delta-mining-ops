# Prueba de integración preparada para copias de Google Sheets

**Estado de esta entrega: NO EJECUTADA EN GOOGLE SHEETS NI EN UN WEB APP REAL.** No se dispone de IDs y acceso confirmado a copias ni de un proyecto de pruebas autorizado. No hay un conector de Sheets habilitado en esta sesión. Las comprobaciones automáticas del kit se realizaron con mocks y análisis local; no se presentan como pruebas reales.

El backend de producción sigue siendo un único archivo completo. Los helpers siguientes son opcionales y **exclusivos de copias**.

## A. Prueba en el editor con dos copias

1. En Google Sheets crear mediante **Archivo → Hacer una copia** copias privadas de la Lista Maestra y Usuarios autorizados. Nombrar los archivos `DELTA_TEST_LISTA_EQUIPOS_V9` y `DELTA_TEST_USUARIOS_V9`. Conservar nombres de pestañas, encabezados, fórmulas, notas, validaciones, formatos, zona horaria y configuración regional.
2. Verificar que las URLs/IDs difieren de todos los IDs originales de `integration/apps-script/copy-map.example.json`. No renombrar los archivos reales para hacerlos pasar por copias.
3. Antes de compartir o publicar el sandbox, **sanitizar la copia de Usuarios**: quitar datos/contraseñas de cuentas reales y mantener los encabezados. Las pruebas agregan cuentas ficticias nuevas con dominio `@example.invalid`. No copiar `APP_AUTH_TOKEN_SECRET` de producción.
4. Crear un proyecto nuevo de Apps Script, sin triggers. No publicar todavía ninguna implementación. En `Code.gs` pegar el **archivo final completo** sin modificar. Agregar `IntegrationCopies.gs` desde `integration/apps-script/IntegrationCopies.gs`. Este helper cambia la configuración sólo durante cada ejecución de prueba; nunca llama a los IDs originales.
5. Mantener runtime V8. En **Configuración del proyecto → Propiedades de secuencia de comandos** crear los nombres y valores del ejemplo `integration/apps-script/editor-properties.example.json`, sustituyendo los IDs:

| Propiedad | Valor |
| --- | --- |
| `DELTA_TEST_ONLY` | `1` |
| `DELTA_TEST_ACK` | `COPIES_ONLY_NO_PRODUCTION` |
| `DELTA_TEST_SCRIPT_ID` | ID de este **nuevo** proyecto, visible en Configuración del proyecto |
| `DELTA_TEST_COPY_CONFIG` | JSON de las dos copias, según el ejemplo de abajo |

```json
{
  "usuarios": {
    "id": "ID_REAL_DE_COPIA_USUARIOS",
    "sheet": "Usuarios autorizados",
    "headerRow": 1
  },
  "lista_equipos": {
    "id": "ID_REAL_DE_COPIA_LISTA",
    "sheet": "lista equipos",
    "headerRow": 5
  }
}
```

Usar el JSON como **un único valor** de `DELTA_TEST_COPY_CONFIG`. Verificar en las copias que las filas 1/5 y los nombres indicados sean correctos; si la copia tiene otra estructura, documentar sus filas reales. La identidad de prueba es código nuevo `CTA-0530` y Drusila `AF479QX`, según el caso informado. Si no coincide con los encabezados reales, la prueba debe fallar antes de escribir; no buscar el código en columnas ajenas.

6. Ejecutar **sólo `deltaCheckCopies`**. Autorizar el proyecto nuevo para acceder a esas copias. Debe devolver `ok:true`, `copyOnly:true`, `cta0530Found:true` y las posiciones de la celda. Si falla, detenerse y corregir la configuración. No ejecutar instaladores, `doPost`, warmers ni funciones de producción desde el selector.
7. Ejecutar **`deltaRunCopiesIntegration`**. Guardar el JSON del registro de ejecución y el estado `DELTA_TEST_LAST_REPORT`. Nunca compartir propiedades completas, contraseñas, tokens o el secreto de autenticación.

### Qué comprueba realmente esta ejecución cuando se realice

- Primer ingreso de una cuenta ficticia nueva.
- Cambio de contraseña con escritura **real en la copia** y respuesta de sesión confirmada.
- Login con la nueva contraseña y rechazo de la anterior.
- Reintento de perfil con el mismo ID.
- Fallo del espejo **inyectado sólo en memoria**, manteniendo real la escritura en la copia; acceso con la nueva contraseña y recuperación posterior del espejo.
- Escritura de la lectura CTA-0530 en su celda, guardado parcial con un código inexistente y conflicto de valor antiguo.
- Recibo idempotente y versión de Lista Maestra sin nuevo incremento en el reintento.
- Respuesta del handler deliberadamente descartada después de guardar y recuperación por verificación. **Esto no es un timeout HTTP real.**
- Hash de las otras columnas, sus fórmulas, notas, formatos numéricos, estilos, alineación, ajuste de texto y validaciones. Se excluye el resultado calculado de una fórmula para no confundir recálculo normal con sobrescritura; se conserva y compara la fórmula misma.
- Número de filas/columnas sin aumento en Lista Maestra. Se agrega una cuenta ficticia en Usuarios como fixture, no se duplica CTA-0530.
- Restauración final **sólo de la celda de lectura en la copia**. Debe informar `meterRestored:true`. Si falla, revisar esa celda en la copia; no tocar la planilla original.

La ejecución no verifica automáticamente todos los posibles estilos de texto enriquecido, reglas de formato condicional, objetos de hoja o cálculos de otros módulos. Revisar esos elementos en la copia si existen reglas relevantes para CTA-0530. No hay un bloqueo transaccional frente a ordenamientos manuales: mantener las copias sin otros editores durante la prueba.

El test conserva el usuario ficticio para inspeccionar su hash. No escribe nuevas contraseñas en texto plano. Al terminar puede eliminarse ese usuario **en la copia**, o descartarse el sandbox entero.

## B. Prueba HTTP real antes de producción

La prueba del editor no comprueba el web app, redirecciones de Google ni timeouts de cliente. Para hacerlo, preparar un sandbox publicable **sólo después de autorizar esa publicación de prueba**. No se hizo aquí.

1. Copiar de manera privada todos los archivos de Sheets configurados: el mapa contiene **14 IDs originales únicos**, incluyendo movimientos, PM y licitaciones. Nombrar cada copia `DELTA_TEST_...`; conservar las pestañas. Sanitizar datos confidenciales antes de exponer un sandbox. Usar copias independientes para originales independientes.
2. Copiar `integration/apps-script/copy-map.example.json` a un archivo local fuera del repositorio y sustituir cada valor por el ID real de su copia. No modificar las claves, que identifican el origen. El generador rechaza placeholders, mapas incompletos, IDs originales y reutilización de una copia para dos archivos originales.
3. En el checkout de la corrección, preparar un directorio **nuevo fuera del checkout**:

```bash
node scripts/prepare-apps-script-copies.mjs /ruta/privada/copy-map.json /tmp/delta-v9-copias-01
```

Esto crea `Code-COPIAS.txt`, `IntegrationCopies.gs` y `manifest.json`. No ejecuta Google, no crea copias y no publica. Todos los cuerpos de las 248 funciones V9 son iguales a los del archivo final. Sólo se sustituyen IDs/GIDs de configuración y se agrega un guard para la implementación de prueba. Los GIDs se vacían para resolver las pestañas por nombre en las copias. Los IDs originales que aparecen en el guard son una **lista de bloqueo**, no destinos activos.

**`Code-COPIAS.txt` no es el archivo de producción ni tiene su misma huella.** Su manifest registra el SHA-256 de su padre canónico y su propia huella. Nunca colocarlo en el proyecto real.

4. En otro proyecto nuevo de Apps Script, pegar `Code-COPIAS.txt` completo en `Code.gs` y agregar el `IntegrationCopies.gs` generado. Configurar las propiedades de A con esas copias. No reutilizar un proyecto que ya tenga secretos de producción.
5. Para HTTP agregar **`DELTA_TEST_ACCESS_KEY`**, una clave aleatoria de al menos 32 caracteres generada localmente o en un gestor de secretos. No usar el placeholder del ejemplo. Es exclusiva del sandbox; no copiar el secreto de autenticación de producción.
6. Ejecutar `deltaCheckCopies`, y después **`deltaPrepareCopyWebUser`**. Esto crea una cuenta ficticia fresca, guarda el snapshot de CTA-0530 y devuelve su email e ID de proyecto sin mostrar contraseñas ni tokens. Si repetís una prueba HTTP, preparar otra cuenta fresca.
7. Con autorización, crear un web app **separado de producción**, ejecutado como la cuenta con acceso a las copias. Elegir el acceso de acuerdo con la política de la organización. Para el cliente Node sin sesión Google, el endpoint debe recibir POST sin redirigir a login; si se permite acceso sin sesión Google, el guard exige la clave de prueba en el cuerpo y limita operaciones/usuario/equipo. Si no se permite ese acceso, no ampliarlo a ciegas: ejecutar el protocolo en un cliente con la sesión Google autorizada y dejar la prueba Node pendiente.
8. En la máquina local, introducir la clave sin imprimirla ni guardarla en el repo. En Bash:

```bash
read -r -s -p 'Clave exclusiva del sandbox: ' DELTA_COPY_TEST_KEY
export DELTA_COPY_TEST_KEY
node scripts/probe-apps-script-copies.mjs 'https://script.google.com/macros/s/ID_DE_IMPLEMENTACION_COPIAS/exec' 'ID_DEL_PROYECTO_DE_PRUEBA'
unset DELTA_COPY_TEST_KEY
```

Guardar sólo el JSON sanitario de resultado. El script bloquea la URL de producción configurada, exige la identidad del proyecto, `copyOnly:true` y la huella padre esperada **antes de enviar una mutación**. La clave viaja en el cuerpo, no como argumento ni en la URL. No hace llamadas a Supabase.

### Protocolo HTTP y lectura del resultado

El cliente realiza primer ingreso, cambio de contraseña, login posterior, rechazo de la anterior, reintento de perfil, CTA-0530, reintento del mismo ID y resultado parcial. Verifica los hashes de integridad mediante el helper del sandbox y restaura sólo la celda de lectura con control de valor esperado.

Para timeout, aborta una solicitud de lectura escrita con un timeout de cliente de 1 ms, espera 60 segundos y verifica **el mismo ID**:

- `clientAbortObserved:true` indica un aborto real del cliente.
- `observedAfterAbort:"complete"` demuestra que la copia tenía persistencia confirmada pese a haberse perdido la respuesta. No se asume que el servidor escribió sólo por haber abortado.
- `observedAfterAbort:"pending"` significa que no se confirmó la escritura; el script reintenta el mismo ID y contenido. Ese caso valida recuperación conservadora, **no** un timeout posterior a escritura confirmada.
- Si la respuesta llegó antes del timeout, `pendingChecks` lo indica. Repetir la comprobación antes de declarar aprobado ese escenario; `DELTA_COPY_ABORT_MS` permite ajustar el timeout.
- Si el valor cambió fuera de los valores confirmados por la prueba, no lo restaura a ciegas. El informe indica la recuperación pendiente en la copia.

El cliente conserva las contraseñas/tokens de la cuenta ficticia sólo en memoria y no los imprime. Si el proceso termina en un error de acceso o red, inspeccionar el reporte y la celda antes de volver a probar. Preparar un usuario ficticio nuevo si ya no está en estado de primer ingreso.

## C. Frontend de staging y checks aún pendientes

El navegador automático de esta entrega intercepta todas las solicitudes externas: es **una prueba con mocks**, aunque use Chromium real. Ejecutarla con `node scripts/audit-browser-integrity.mjs` no sustituye una prueba contra el sandbox de Google.

Para una comprobación manual del frontend, el kit incluye un proxy local ya preparado; no hay que editar los destinos de producción:

1. Completar B y crear una **cuenta ficticia fresca** con `deltaPrepareCopyWebUser` si ya se ejecutó la prueba HTTP. Usar un perfil de navegador privado para no cargar sesiones ni caches de producción.
2. Introducir la clave privada igual que en B y ejecutar:

```bash
node scripts/serve-copy-frontend.mjs 'https://script.google.com/macros/s/ID_DE_IMPLEMENTACION_COPIAS/exec' 'ID_DEL_PROYECTO_DE_PRUEBA'
```

3. Abrir el navegador local en `http://127.0.0.1:5176`. El servidor primero verifica proyecto, sandbox y huella; bloquea la URL de producción configurada. La clave queda en el servidor y se agrega al cuerpo del pedido hacia Google; no se incorpora como `VITE_*`, argumento, bundle ni respuesta de navegador.
4. Usar el email ficticio que muestra el servidor y la contraseña de primer ingreso conocida `DELTA.MINING.APP`. Crear una contraseña personal y comprobar el modal, acceso inmediato y recarga con la sesión actualizada. No usar cuentas reales.
5. Abrir Lista Maestra y actualizar la lectura de CTA-0530. El proxy entrega **la fila de la copia real**; ROP02 es un fixture simulado con lectura inicial + 1. Verificar la nueva lectura y los hashes con el `copy_test_status`/editor y revisar la fila de la copia.
6. Para verificar login posterior, salir y volver a ingresar con la nueva contraseña; comprobar que la anterior no sirve. Revisar que la segunda pulsación del botón no genere otra diferencia ni una reescritura.
7. Cerrar el servidor con Ctrl+C y quitar la variable de entorno. Esta prueba visual deja la lectura modificada en la **copia** para inspección; no realiza restauración automática. Si se desea restaurar, usar sólo la celda de lectura y su valor base verificado, o descartar la copia. No restaurar una fila completa.

El servidor sirve únicamente la integración autorizada: autenticación/perfil/horómetros y lectura dirigida de CTA-0530. Las otras acciones de escritura están bloqueadas; las lecturas operativas y el manifiesto son simulados y aparecen identificados como tales. Una política `connect-src` limita las conexiones del navegador al servidor local, bloqueando Supabase directo y el respaldo de Apps Script de producción. El servidor no importa el handler de producción ni realiza requests a Supabase. Aparece un aviso visible de **integración mixta**, que no debe presentarse como prueba real de los otros módulos.

No se inició este proxy con Google real ni se publicó un frontend remoto. Se validaron sus controles con mocks; el recorrido manual anterior sigue pendiente. Para probar todos los módulos sin simulaciones hace falta un sandbox adicional revisado, no relajar el guard de este kit.

## Registro obligatorio antes de aprobar producción

Guardar: fecha, ID del proyecto de prueba, IDs de copias, manifest/huella de `Code-COPIAS.txt`, versión anunciada, JSON del editor, JSON HTTP, `meterRestored`, errores, pendientes, captura de la fila antes/después sin credenciales y resultados del frontend. La exportación del proyecto instalado es necesaria para demostrar que el código remoto coincide con el artefacto esperado; el endpoint no calcula el hash de su propia fuente.

Actualmente quedan pendientes **todas las ejecuciones en servicios reales**, permisos/latencia de Google, cuotas con el volumen real, revisión de formatos no cubiertos por el snapshot, el recorrido visual contra Google, retiro/verificación del RPC viejo de Supabase y medición real de Egress.
