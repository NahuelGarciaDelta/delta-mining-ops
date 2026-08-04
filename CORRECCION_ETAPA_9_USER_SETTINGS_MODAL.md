# Corrección Etapa 9 — UserSettingsModal

Se corrigió el error de producción:

`ReferenceError: UserSettingsModal is not defined`

Cambios:

- Se extrajo `UserSettingsModal` de `LicitacionesModule.jsx`.
- Se creó `src/components/UserSettingsModal.jsx`.
- `App.jsx` importa el componente explícitamente.
- Las dependencias `APPS_SCRIPT_URL`, `C`, `Spinner` e `Icon` se pasan por props.
- Se eliminó la definición accidental del modal dentro del módulo Licitaciones.

Validaciones realizadas:

- Compilación sintáctica y resolución de imports de todos los archivos `src/**/*.js` y `src/**/*.jsx` mediante TypeScript: OK.
- Verificación sintáctica de `src/workers/informeCostos.worker.js`: OK.
- Verificación sintáctica de `src/modules/informe-costos/engine/InformeCostosEngine.js`: OK.

El build de Vite no pudo ejecutarse en este entorno porque el único `node_modules` disponible contiene Vite 8 para Windows y le falta el binding nativo Linux de Rolldown. El código fuente corregido sí pasó la validación de compilación indicada arriba.
