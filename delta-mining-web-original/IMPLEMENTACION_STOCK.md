# Dashboard Stock compartido

La única fuente de backend vigente es `AppsScript_Delta_Mining_OPS_FINAL.txt`.

## Persistencia

- Spreadsheet: `1CYXvmXk7XknGWq4TUJyTAaXz_TH1JOWcl2Zm7XurFTI`.
- Datos activos: `STOCK CRITICO`.
- Preparación de reemplazo: `STOCK CRITICO TEMP`.
- Metadata: `STOCK_META`.
- Auditoría: `STOCK_HISTORIAL`.
- El flujo de Stock no utiliza Google Drive ni recibe archivos Base64.

El frontend procesa `.xlsx`/`.xls` con SheetJS, valida encabezados y filas, muestra un resumen y envía solamente las filas aceptadas. Apps Script repite las validaciones, escribe la hoja temporal bajo `LockService`, verifica la cantidad y realiza el intercambio de pestañas. Ante un error previo a la publicación, `STOCK CRITICO` permanece intacta.

## Endpoints

- GET: `stock_excel_status`, `stock_excel_data`, `get_stock_active`, `stock_active`.
- POST: `stock_excel_upload`, `stock_excel_replace`, `stock_excel_clear`, `upload_stock`.

Las escrituras requieren `actor.email` y `actor.token`. Cargar/reemplazar está permitido para administradores, Abastecimiento y Oficina Técnica. La limpieza global es exclusiva para administradores.

## Publicación

1. Copiar todo el contenido de `AppsScript_Delta_Mining_OPS_FINAL.txt` al proyecto de Apps Script.
2. Publicar una nueva versión de la aplicación web conservando su URL.
3. Cerrar sesión e iniciar nuevamente para obtener un token emitido por esa versión.

Las hojas se crean automáticamente en la primera operación. No se requiere habilitar OAuth de Drive para Stock.
