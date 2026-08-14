# Delta Mining V3 — Etapas 13 a 15 combinadas

Este build agrupa varias tareas arquitectónicas en una sola entrega:

1. Configuración centralizada de Apps Script en `src/config/app.js`, con soporte para `VITE_APPS_SCRIPT_URL`.
2. Caché y persistencia extraídas a `src/services/appCache.js`.
3. Ordenamiento global de tablas extraído a `src/hooks/useGlobalThreeStateTableSort.js`.
4. Pantalla de error compartida extraída a `src/components/ErrorScreen.jsx`.
5. Limpieza de `App.jsx`, eliminando implementaciones duplicadas y dependencias implícitas.

La funcionalidad y las claves de almacenamiento se conservaron.
