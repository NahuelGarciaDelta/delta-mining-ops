# Diferencias verificadas entre el original adjunto y V9

Original: `audit/apps-script-original-v8.txt`, copia byte por byte del adjunto. SHA-256: `9f8bd8c4f257e8f8963ecfec27906f45e6690c917c299a191a2497883e01d0c5`.

Final: `AppsScript_Delta_Mining_OPS_FINAL.txt`. SHA-256: `6e53019c95dd52ec7422fdf3aa2aa799e6c9fad776719bbdc65e36522987c59a`.

El original tiene **231 funciones globales** y el final **248**. Hay **8 modificadas**, **17 nuevas**, **0 eliminadas** y **223 con cuerpo intacto**. Se cuentan declaraciones `function nombre(...)` al nivel del backend; callbacks anónimos y helpers locales no son interfaces globales adicionales.

La comparación usa AST y hashes de cuerpos completos, normalizando únicamente CRLF/LF. Los comentarios dentro de las funciones también forman parte del hash. El diff textual mueve las funciones corregidas al final del archivo; eso no elimina sus nombres ni interfaces.

## Funciones modificadas

| Función | Línea original | Línea V9 |
| --- | ---: | ---: |
| `doPost` | 370 | 370 |
| `handleBulkUpdateListaEquiposFromApp_` | 2915 | 6390 |
| `handleUpdateListaEquipo_` | 2776 | 6394 |
| `refreshAuthMirror_` | 2491 | 6440 |
| `getAuthMirrorUser_` | 2528 | 6468 |
| `handleAuthenticateUser_` | 2543 | 6481 |
| `findUsuarioRowByEmail_` | 2464 | 6492 |
| `handleUpdateUserProfile_` | 2553 | 6501 |

## Funciones nuevas

| Función | Línea V9 |
| --- | ---: |
| `listaMutationError_` | 6220 |
| `listaExactHeader_` | 6223 |
| `listaMeterContext_` | 6230 |
| `listaMeterCode_` | 6244 |
| `listaMeterRow_` | 6245 |
| `listaMeterValidateRow_` | 6264 |
| `listaMeterNumber_` | 6273 |
| `listaMeterReceiptKey_` | 6280 |
| `listaMeterPrune_` | 6281 |
| `authorizeListaMeters_` | 6290 |
| `handleListaHorometros_` | 6297 |
| `authDirtyKey_` | 6415 |
| `authCredential_` | 6416 |
| `authRecord_` | 6422 |
| `authPublicResult_` | 6428 |
| `authMirrorWrite_` | 6432 |
| `authCanonicalUser_` | 6463 |

## Validación estática

- Sintaxis: válida, con parser JavaScript y compilación V8/Node sin ejecutar servicios.
- Funciones globales duplicadas: ninguna.
- Referencias a identificadores/funciones no declarados: ninguna, permitiendo las APIs nativas de Apps Script y los builtins de JavaScript.
- Callbacks registrados en triggers: `onDatasetSheetChange_` y `actualizarMantenimientoProgramadoDesdeROP02` existen.
- La comprobación no certifica permisos OAuth, métodos nativos o tiempos reales de Google; esos puntos quedan pendientes de ejecución sobre copias.

## Compatibilidad y correcciones

- `doPost` conserva las acciones previas y agrega `update_lista_horometros` y `verify_lista_horometros`. El bulk heredado exige ahora el nuevo contrato, identificador de operación y actor: rechaza clientes antiguos antes de escribir.
- La edición explícita de equipos sigue existiendo. La ruta de horómetros no la reutiliza; `cell` corresponde a `getRange(row, context.meter + 1)` y la única escritura de lectura es `cell.setValue(value)`.
- La identificación de CTA-0530 usa `codigoNuevo:"CTA-0530"` y `codigoDrusila:"AF479QX"`. No usa modelo, índices guardados ni otros campos de la fila.
- El login corregido usa `authenticate_user` del mismo backend que guarda la contraseña. La respuesta incluye `capabilities.passwordHashProfile`, `capabilities.meterCellWrites`, usuario, token y `mustChangePassword`.
- Las nuevas contraseñas se guardan con prefijo `dm-hmac-v1:` en la columna existente; el espejo interpreta el hash y no vuelve a tratarlo como contraseña en texto plano. Los registros heredados siguen compatibles y se migran cuando cambia la contraseña.
- Los fallos de espejo no dejan válida la contraseña anterior. Los recibos y las comprobaciones por celda recuperan respuestas perdidas sin repetir lo ya confirmado.
- Configuración de las planillas, constantes de almacenamiento, APIs ajenas y las otras 223 funciones se mantienen respecto del adjunto. Sólo cambia la constante de versión y las ocho funciones listadas.

## Reproducir la comparación

```bash
npm ci
node scripts/apps-script-audit.mjs audit/apps-script-original-v8.txt AppsScript_Delta_Mining_OPS_FINAL.txt /tmp/comparacion-v9.json
```

Archivos asociados: [JSON completo](comparacion-funciones.json), [diff textual completo](original-a-v9.patch), [validación](VALIDACION.md), [instalación](INSTALACION.md).

El original revisado es el adjunto del usuario. No se descargó ni se inspeccionó el proyecto actualmente publicado; cualquier `.gs` adicional que no figure en ese adjunto requiere inventario antes de reemplazar código.

## Revisión adicional del frontend de esta entrega

Se corrigió `listaIdentityFromRow` para aceptar los alias `Código nuevo`/`Codigo nuevo` y Drusila que el adaptador Supabase agrega cuando sus valores son iguales. Antes podían producir identidad vacía y omitir las diferencias de horómetro. Alias contradictorios se siguen rechazando. Hay dos regresiones automatizadas adicionales. Esto no modifica el backend entregado ni sus 248 funciones.
