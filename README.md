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
- `backend/AppsScript.gs`: backend que debe copiarse al proyecto de Google Apps Script.

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
