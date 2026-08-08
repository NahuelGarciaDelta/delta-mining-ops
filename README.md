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
