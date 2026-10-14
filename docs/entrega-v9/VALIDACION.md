# Validación del archivo final entregado

Archivo: **`AppsScript_Delta_Mining_OPS_FINAL.txt`**, completo y único para producción.

- Versión: `2026-10-14-AUTH-METER-INTEGRITY-V9`.
- Tamaño: **287.664 bytes**; **6.557 líneas con salto de línea final**.
- SHA-256 antes y después de las pruebas: **idéntico**.

```text
6e53019c95dd52ec7422fdf3aa2aa799e6c9fad776719bbdc65e36522987c59a
```

El harness de pruebas lee directamente este archivo. La prueba de entrega también compara sus bytes UTF-8 con los bytes del harness y calcula el hash del mismo archivo. No hay una versión de backend separada escondida en las pruebas, ni se reemplazó el archivo por fragmentos después de validar.

## Resultados finales

| Validación | Resultado |
| --- | --- |
| `npm run validate` | **384 pruebas aprobadas, 0 fallidas, 0 omitidas**; imports, sintaxis de motor/worker y auditoría de seguridad aprobados |
| `npm run build` | Aprobado, Vite 5.4.14 |
| `npm run lint` | Aprobado: **0 errores**, 823 advertencias existentes |
| `npm run format:check` | No aprobado: **229 archivos existentes** pendientes de estilo; no se reformateó todo el repo |
| Sintaxis del GAS completo | Aprobada: parser y compilación V8/Node |
| Comparación de funciones | 231 originales / 248 finales; 8 modificadas, 17 nuevas, 0 eliminadas, 223 cuerpos idénticos |
| Duplicados / referencias estáticas ausentes | 0 / 0 |
| Callbacks de triggers registrados | Ambos resueltos |
| `git diff --cached --check` | Aprobado |
| Navegador | Primer ingreso, cambio obligatorio y recarga de sesión aprobados; sin excepciones sin manejar |
| Google Sheets real / web app real | **No ejecutados** |
| Migración SQL / deploy de producción | **No ejecutados** |

Las **371 pruebas** del informe anterior se reejecutaron, y se agregaron **13**: 11 para comparación, controles del kit y proxy de copias; 2 para los alias equivalentes/contradictorios que entrega el adaptador Supabase. Los nuevos archivos JS se formatearon. El aviso anterior de `progressive-rows` sobre `footer remitos` sigue presente y no impide compilar.

La prueba de CTA-0530 usa un **mock**, con datos conocidos y columnas adicionales sintéticas. Guarda valores/metadatos antes, comprueba una única escritura 1×1 de HORAS y ausencia de filas nuevas. Las pruebas de timeout y espejo con mocks/inyección se etiquetan como tales. La ejecución Chromium es real, pero su red y su backend son simulados; no demuestra acceso a Google ni latencia de servicios reales.

El kit real preparado se validó en su estructura, sintaxis, guards y protocolo usando mocks. No se creó ninguna copia remota ni implementación. Ver [INTEGRACION-COPIAS.md](INTEGRACION-COPIAS.md) para ejecutar las pruebas reales y registrar sus resultados.

## Reproducibilidad

```bash
npm ci
node scripts/apps-script-audit.mjs audit/apps-script-original-v8.txt AppsScript_Delta_Mining_OPS_FINAL.txt /tmp/auditoria-final.json
npm run validate
npm run lint
npm run build
node scripts/audit-browser-integrity.mjs
sha256sum AppsScript_Delta_Mining_OPS_FINAL.txt
```

El navegador requiere Chromium y Node 22 o superior; aquí se usó Node 24. El checksum del archivo canónico se fuerza a LF en `.gitattributes` para no variar por el checkout en Windows. El original adjunto se conserva byte por byte con CRLF.

El [recibo JSON](validacion.json) incluye hashes, blob Git y resultados. El commit que contiene las correcciones y estos entregables se informa al terminar y se verifica contra el blob del archivo. La fuente remota publicada no se exportó ni se comparó: ninguna declaración de este documento certifica que producción ya esté corriendo V9.

Los atributos de los dos artefactos de auditoría conservan CRLF del original y los espacios de contexto obligatorios del diff; no se recortan sus bytes para aparentar igualdad. Las comprobaciones de espacios del código normal siguen habilitadas.
