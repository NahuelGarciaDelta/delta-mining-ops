# Delta Mining OPS V3 RC

Aplicación web React/Vite conectada a Google Sheets mediante Google Apps Script.

## Estructura

- `src/App.jsx`: orquestación general, sesión, carga de datos y navegación.
- `src/modules/`: módulos funcionales (Oficina Técnica, Mantenimiento, Abastecimiento, Licitaciones e Informe de Costos).
- `src/components/`: componentes reutilizables.
- `src/shared/`: normalización, formatos, reglas de equipos y utilidades de dominio.
- `src/services/`: API de Apps Script, caché, diálogos y escrituras.
- `src/config/`: configuración y dependencias de módulos.
- `src/workers/`: cálculos pesados del Informe de Costos.
- `AppsScript_Delta_Mining_OPS_FINAL.txt`: único backend vigente; debe copiarse completo al proyecto de Google Apps Script. Las menciones a `backend/AppsScript.gs` dentro de `docs/history` son exclusivamente históricas y no deben usarse para desplegar.

## Ejecutar localmente

```bash
npm install
npm run validate
npm run build
npm run dev
```

## Configuración

Copiar `.env.example` como `.env` y completar `VITE_APPS_SCRIPT_URL` cuando se necesite usar otra implementación de Apps Script.

## Publicar

```bash
npm run build
```

La carpeta de salida es `dist`.

## Calidad y seguridad

Antes de subir cambios ejecutar:

```bash
npm install
npm run validate
npm run lint
npm run format:check
npm run build
```

- `npm run validate`: imports locales, sintaxis del motor/worker, auditoría de seguridad y tests unitarios.
- `npm run lint`: auditoría de seguridad + ESLint.
- `npm test`: tests de reglas críticas de costos y sanitización.
- `npm run format`: normaliza el estilo con Prettier.
- `npm run build`: compilación de producción con Vite.

Las notas históricas de correcciones anteriores están archivadas en `docs/history/`. Para cambios nuevos usar commits descriptivos y actualizar `CHANGELOG.md` cuando corresponda.

## Auditoría de autenticación y horómetros (14/10/2026)

Las correcciones y los pasos de revisión/despliegue están documentados en [el informe de auditoría](docs/auditoria-auth-horometros-2026-10-14.md). El backend completo corregido es `AppsScript_Delta_Mining_OPS_FINAL.txt`, versión `2026-10-14-AUTH-METER-INTEGRITY-V9`, basado en el script adjunto a esta revisión. `AppsScript_Delta_Mining_OPS_ROP02_OK.txt` permanece como versión anterior y no debe desplegarse sobre contraseñas migradas a hash.

El frontend nuevo requiere el backend actualizado para autenticar y cambiar contraseñas. Publicar primero el backend y después el frontend, únicamente tras revisar los cambios y probar una copia de las planillas. La migración SQL de retiro del RPC antiguo es manual; no se ejecuta durante instalación ni tests.

Para comprobar primer ingreso y cambio obligatorio en un navegador con todas las solicitudes externas simuladas:

```bash
node scripts/audit-browser-integrity.mjs
```

Este test requiere Node 22 o superior y Chromium; puede elegirse el ejecutable con `CHROME_BIN`. Inicia y cierra sus propios procesos y no accede a datos reales.

El [paquete de entrega V9](docs/entrega-v9/INSTALACION.md) incluye instalación, [diferencias verificables](docs/entrega-v9/DIFERENCIAS.md) y [kit de integración en copias](docs/entrega-v9/INTEGRACION-COPIAS.md). El archivo de producción es único y completo; los helpers y `Code-COPIAS.txt` son exclusivos de pruebas.
