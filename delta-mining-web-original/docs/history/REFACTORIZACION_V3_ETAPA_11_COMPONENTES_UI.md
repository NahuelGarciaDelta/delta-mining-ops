# Delta Mining V3 — Etapa 11

Se extrajeron de `App.jsx` el tema visual, estilos globales y componentes UI compartidos.

## Nueva estructura

- `src/components/ui/index.jsx`

Incluye: `C`, `STYLES`, `Icon`, `Spinner`, `Badge`, `StatCard`, `Card`, `Table`, `SortableTH`, `Sel`, `MultiSel`, `DateIn`, pestañas, alertas y helpers de selección/ordenamiento.

No se modificó la interfaz ni la lógica funcional. Los módulos existentes continúan recibiendo las mismas dependencias desde `App`.
