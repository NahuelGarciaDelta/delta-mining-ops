# Delta Mining V3 — Etapa 9: Oficina Técnica modular

## Cambios realizados

Se extrajo del archivo `src/App.jsx` el bloque principal de Oficina Técnica y se creó:

- `src/modules/oficina-tecnica/OficinaTecnicaModule.jsx`
- `src/modules/oficina-tecnica/OficinaTecnicaRoute.jsx`
- `src/modules/oficina-tecnica/index.js`

El módulo incluye:

- Dashboard operativo.
- Lista Maestra de Equipos.
- Taller Central.
- ROP02.
- Horómetros.
- Vehículos.
- Control de ROP02.
- Control de errores.
- Control por equipo.
- Atraso ROP02.
- Combustible.
- ROP05.
- Discriminación por tarea.
- Control RMA15 por equipo.
- ICHC.
- Consistencia ROP02 vs ROP05.

## Resultado

- `App.jsx` pasó de aproximadamente 10.800 líneas a unas 5.300 líneas.
- Oficina Técnica se carga de forma diferida mediante `React.lazy()`.
- Se conservó el estado de filtros administrado por `App` para evitar cambios funcionales.
- Se mantuvieron las funciones de exportación, edición y actualización contra Apps Script.
- Se restauraron en `App.jsx` las definiciones compartidas de tipos de máquina que también usa Mantenimiento.

## Validación

Se verificó el parseo JSX/JavaScript de:

- `src/App.jsx`
- `src/modules/oficina-tecnica/OficinaTecnicaModule.jsx`
- `src/modules/oficina-tecnica/OficinaTecnicaRoute.jsx`

También se revisaron referencias externas del módulo. No se modificaron cálculos ni reglas de negocio.

## Verificación local recomendada

```bash
npm install
npm run build
npm run dev
```

Luego probar todas las vistas listadas arriba y revisar la consola del navegador.
