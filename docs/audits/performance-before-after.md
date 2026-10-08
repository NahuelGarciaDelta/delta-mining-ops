# Mediciones de rendimiento

## Condiciones

- Base: `b8c22e612f5a181f90f396adb1639095a695ba78` más `53ef6aa`.
- Build: Vite 5.4.14 y Node 24.18.0 en Windows.
- El sandbox rechaza `fs.realpathSync.native` sobre archivos locales con `EPERM`, aun cuando `fs.realpathSync` funciona y las ACL permiten acceso. Para aislar Vite se ejecutó un archivo temporal no versionado:

```js
const fs = require("node:fs");
fs.realpathSync.native = fs.realpathSync;
```

Luego: `NODE_OPTIONS=--require=./vite-realpath-workaround.cjs npm run build`.

## Resultado medible

| Indicador | Antes | Después | Mejora |
| --- | ---: | ---: | ---: |
| Transformación Vite | 1 módulo; aborta por `EPERM` | 957 módulos | Build recuperado |
| Tiempo de build | NO MEDIDO (abortó a 50–266 ms) | 11,11 s | No comparable |
| `index` comprimido | NO DISPONIBLE | 216,64 kB gzip | Línea base |
| `xlsx-vendor` comprimido | NO DISPONIBLE | 143,15 kB gzip | Línea base |
| `charts-vendor` comprimido | NO DISPONIBLE | 110,31 kB gzip | Línea base |
| Tiempo cold/warm autenticado | NO MEDIDO | NO MEDIDO | Sin navegador local automatizable ni sesión de prueba aislada |

El build confirma el code splitting existente para Mantenimiento, Abastecimiento, Oficina Técnica, Informe de Costos y Licitaciones. El chunk principal sigue siendo 216,64 kB gzip; reducirlo exige extraer lógica heredada de `App.jsx`, cambio de alto riesgo que no se aplicó sin perfiles de interacción comparables.

No se declaran porcentajes de rendimiento del usuario final sin una medición cold/warm equivalente.
