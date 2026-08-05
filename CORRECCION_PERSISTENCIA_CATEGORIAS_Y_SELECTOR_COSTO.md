# Corrección de categorías y selector de costo

## Categorías de amortización
- Se agregó una fuente persistente compartida: `dm_amortization_categories_v2`.
- Las categorías creadas, renombradas, eliminadas y las asignaciones por tipo/modelo se guardan inmediatamente.
- Informe de Costos y Licitaciones leen la misma configuración.
- Los cambios se sincronizan mediante eventos internos sin tener que recargar la aplicación.

## Selector de costo de adquisición
- Se corrigió la lectura del precio del equipo seleccionado.
- El selector utilizaba `selected.costo`, pero las opciones contienen el valor en `selected.adquisicion`.
- Al elegir una unidad ahora cambia el valor visible y se recalculan amortización y total horario.
- La selección continúa guardándose por categoría en Local Storage.

## Validación
- `npm run validate`: correcto.
- 50 archivos JS/JSX e imports locales verificados.
- Worker y motor de Informe de Costos pasan `node --check`.
