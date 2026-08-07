# Corrección Oficina Técnica — dependencias de colores

Se corrigió el bloqueo al abrir Oficina Técnica:

`Cannot read properties of undefined (reading 'green')`

Causa: `ROP05_UNIDADES_CONFIG` se evaluaba al cargar el módulo antes de que `App.jsx` inyectara el objeto de colores `C`.

Corrección:
- se agregó una paleta de respaldo disponible desde la carga del módulo;
- al recibir las dependencias reales, la paleta se combina con `deps.C`;
- no se modificaron cálculos, filtros ni vistas.

Validación realizada:

```bash
tsc --allowJs --checkJs false --jsx react-jsx --noEmit --skipLibCheck --module esnext --target es2020 --moduleResolution bundler src/App.jsx src/modules/oficina-tecnica/OficinaTecnicaModule.jsx src/modules/oficina-tecnica/OficinaTecnicaRoute.jsx src/main.jsx
```

Resultado: sin errores.

El build de Vite no pudo ejecutarse en este entorno porque el registro interno no dispone de `@vitejs/plugin-react@4.3.4` y el `node_modules` previo contenía un binding nativo de otra plataforma.
