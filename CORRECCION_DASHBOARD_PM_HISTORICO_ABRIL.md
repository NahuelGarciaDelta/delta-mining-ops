# Corrección Dashboard de Mantenimiento Programado

## Archivos modificados

- `src/modules/mantenimiento/MantenimientoProgramadoView.jsx`

## Cambios

- Se agregó una barra visible de subpestañas: Dashboard, Panel, Registrar realizado, Configuración e Historial.
- El gráfico de PM realizados consolida `PM_REGISTROS` con las fechas de último PM existentes en `PM_CONFIG` y en la carga inicial del Excel.
- Los registros se deduplican por interno, fecha y horómetro.
- El gráfico comienza en abril de 2026 y no muestra meses anteriores sin información.
- Se reemplazó la tarjeta de un único próximo mantenimiento por un listado de próximos mantenimientos.
- Se mantienen los bloques de PM urgentes y PM posibles para el próximo turno dentro del Dashboard.

## Validación

- `npm run validate`: correcto, 53 archivos JS/JSX y todos los imports locales resuelven.
- Datos iniciales detectados desde abril: abril 5, mayo 17, junio 19, julio 9.
- `npm install` no pudo completarse en el entorno de validación porque el registro npm interno no contiene `@vitejs/plugin-react@4.3.4`; por ese motivo no fue posible ejecutar Vite aquí.
