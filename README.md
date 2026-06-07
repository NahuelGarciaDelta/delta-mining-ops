# Delta Mining OPS

Aplicación web React/Vite conectada a Google Sheets mediante Google Apps Script.

## Ejecutar localmente

```bash
npm install
npm run dev
```

Luego abrir la URL que muestra Vite, normalmente `http://localhost:5173`.

## Publicar en Vercel

1. Subir este proyecto a GitHub.
2. Importar el repositorio en Vercel.
3. Framework: Vite.
4. Build Command: `npm run build`.
5. Output Directory: `dist`.

La URL del Apps Script está configurada dentro de `src/App.jsx` en la constante `APPS_SCRIPT_URL`.
