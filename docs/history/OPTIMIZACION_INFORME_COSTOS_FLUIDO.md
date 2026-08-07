# Optimización general — Informe de Costos

Se optimizó el módulo sin modificar fórmulas, filtros, equivalencias, resultados ni exportaciones.

## Cambios aplicados

- Memoización del módulo completo para evitar renderizados causados por estados ajenos o polling.
- Caché de correlación de equipos con Lista Maestra: variantes de código, código canónico, propiedad y metadatos.
- Precalculo por registro del total de insumos y tipo de mantenimiento, reutilizado por todas las tablas.
- Eliminación de recorridos repetidos de insumos en Tabla de costos, Costo mensual y Mano de obra.
- Subtotales de Costo mensual calculados una sola vez por actualización, no una vez por celda.
- Ordenamiento mensual calculado una sola vez por proyecto.
- Exportación mensual memoizada y preparada sólo cuando cambian sus fuentes.
- Renderizado progresivo de tablas grandes para repartir la creación de filas entre varios frames.
- Selector de categorías con estado local y confirmación diferida para que el click no congele la app.
- Edición del nombre de categorías sin recalcular en cada tecla; se confirma al salir o con Enter.
- Actualización del caché PWA.

## Verificación

Se intentó ejecutar `npm run build`. El proyecto incluido usa Vite 8/Rolldown y las dependencias originales fueron instaladas en Windows; este entorno Linux no dispone del binding nativo `@rolldown/binding-linux-x64-gnu`. Además, el registro interno no ofrece `xlsx-js-style@1.2.0`, por lo que no fue posible reinstalar todo aquí.

En la PC de desarrollo ejecutar:

```bash
npm install
npm run build
npm run dev
```
