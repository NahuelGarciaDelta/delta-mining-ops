# Delta Mining OPS V3 — Etapa 1

## Objetivo
Separar el módulo completo **Informe de Costos** del archivo monolítico `src/App.jsx` sin modificar su interfaz, cálculos ni comportamiento.

## Cambios realizados
- Se extrajo `ViewCostosMant` (más de 3.300 líneas) a:
  - `src/modules/informe-costos/InformeCostosView.jsx`
- `App.jsx` conserva únicamente la integración del módulo mediante `MemoViewCostosMant`.
- Las dependencias compartidas actuales se inyectan mediante `INFORME_COSTOS_DEPS`, evitando duplicar funciones durante esta primera etapa.
- Se mantuvieron el motor, Worker, cliente y hooks creados previamente.
- Se agregó una copia operativa del backend en:
  - `backend/AppsScript.gs`

## Resultado
- `src/App.jsx` se redujo en aproximadamente 3.300 líneas.
- El módulo Informe de Costos ya tiene una frontera física propia para continuar la refactorización.
- No se cambiaron fórmulas, filtros, equivalencias, categorías ni exportaciones.

## Validaciones realizadas
- Parseo JSX/JavaScript completo mediante TypeScript (`noEmit`).
- Verificación de nombres externos requeridos por el módulo.
- Verificación sintáctica del motor y Worker existentes.

## Próxima etapa
Extraer del puente `INFORME_COSTOS_DEPS` los componentes UI y utilidades compartidas a módulos reales:
- `components/ui`
- `utils/equipos`
- `utils/filtros`
- `utils/formato`

Después se dividirán las subpestañas del Informe de Costos en componentes independientes.
