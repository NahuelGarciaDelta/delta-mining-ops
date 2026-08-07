# Web Worker — Informe de Costos — Fase 4

## Optimización visual incorporada

Se virtualizaron las tablas que todavía podían bloquear React al crear muchas filas y controles simultáneamente:

- Amortización.
- Categorías por modelo.
- Resumen por equipo.

## Funcionamiento

- React renderiza únicamente las filas visibles y un margen de seguridad.
- Los cálculos, filtros y exportaciones continúan usando la colección completa.
- En Categorías por modelo sólo existen en el DOM los selectores visibles.
- Al desplazarse, las filas se reemplazan mediante una ventana virtual con altura fija.
- Se conserva la última información calculada por el Worker.

## Efecto esperado

- Menor tiempo al abrir Amortización.
- Menor consumo de memoria.
- Desplazamiento más fluido.
- Asignar categorías no obliga a React a mantener cientos de selectores activos.
- Resumen por equipo no crea todas sus filas al mismo tiempo.

## Validación realizada

Se validó la sintaxis JSX/JavaScript mediante TypeScript en modo `allowJs` y la sintaxis del Worker mediante `node --check`.

Para compilar en la PC:

```bash
npm install
npm run build
npm run dev
```
