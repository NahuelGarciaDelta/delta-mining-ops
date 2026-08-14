# Delta Mining V3 — Etapa 2

## Cambios

- Informe de Costos ahora se carga con `React.lazy` únicamente cuando se abre la vista.
- Se agregó un límite de errores propio del módulo para que un fallo no deje en blanco toda la aplicación.
- Se agregó una pantalla de carga específica del módulo.
- Se creó `InformeCostosRoute.jsx`, que aísla los cambios de props y evita renderizados por cambios externos no relacionados.
- Se mantiene intacta la lógica funcional de `InformeCostosView.jsx`.

## Estructura nueva

- `src/modules/informe-costos/InformeCostosRoute.jsx`
- `src/modules/informe-costos/components/InformeCostosBoundary.jsx`

## Alcance

Esta etapa mejora aislamiento, carga inicial y mantenibilidad. La eliminación de los bloqueos internos depende de las próximas etapas: mover los `useMemo` pesados restantes al motor y separar las tablas en componentes memoizados.
