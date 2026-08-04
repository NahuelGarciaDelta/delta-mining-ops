# Delta Mining V3 — Etapas 16 a 19 combinadas

## Cambios realizados

### Etapa 16 — Servicio de diálogos
- `appAlert` y `appConfirm` se trasladaron a `src/services/dialogService.js`.
- El manejador del modal se registra desde `App.jsx` mediante `setAppDialogHandler`.
- Se eliminó la dependencia global mutable que estaba definida directamente en `App.jsx`.

### Etapa 17 — Servicio de Apps Script
- La construcción de URLs, reintentos, timeout, expansión de respuestas compactas y concurrencia se trasladaron a `src/services/appsScriptApi.js`.
- Se centralizaron `fetchAction`, `fetchHealth`, `fetchSource`, `fetchSyncVersions` y `runWithConcurrency_`.
- La lógica de consulta ya no vive mezclada con el componente principal.

### Etapa 18 — Configuración de fuentes
- `VIEW_SOURCES` se trasladó a `src/config/viewSources.js`.
- Los recursos requeridos por cada vista quedan declarados en un único archivo de configuración.

### Etapa 19 — Recursos estáticos
- Se extrajeron las imágenes Base64 de `App.jsx`, Home y estilos globales.
- Las imágenes ahora se sirven desde `public/img/embedded` y pueden ser cacheadas de forma independiente por el navegador.
- El fondo de Login se sirve desde `public/img/login-fondo.webp`.
- `App.jsx` quedó reducido a unas 3.726 líneas y aproximadamente 224 KB.

## Validaciones realizadas
- Parseo de los 42 archivos JS/JSX con TypeScript (`transpileModule`).
- Verificación de imports locales: no se detectaron rutas inexistentes.
- `node --check` sobre servicios, configuración y Web Worker.
- Búsqueda de imágenes Base64 restantes en `src`: no quedaron recursos embebidos.

## Build de Vite
Se intentó ejecutar `npm install`, pero el registro npm disponible en el entorno devolvió 404 para `@vitejs/plugin-react@4.3.4`. Por ese motivo el build final debe ejecutarse localmente:

```bash
npm install
npm run build
npm run dev
```
