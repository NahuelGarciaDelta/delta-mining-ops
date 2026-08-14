# Web Worker — Fase 3A

## Cambios realizados

- Se trasladó al Web Worker persistente el filtrado y agrupamiento de:
  - Costo mensual acumulado.
  - Costo mensual usado por Mano de Obra.
  - Acumulado por equipo.
- El Worker mantiene en memoria:
  - histórico mensual;
  - registros dinámicos compactados;
  - metadatos normalizados de equipos.
- Los cambios de filtros envían solamente parámetros, sin reenviar RMA15 completo.
- La compactación inicial se realiza en lotes de 300 registros entre frames para evitar bloquear la interfaz.
- React mantiene el último resultado visible mientras llega la actualización.
- Se eliminaron los recorridos síncronos duplicados de historial y costo mensual que antes se ejecutaban en el hilo principal.
- Se actualizó el caché PWA.

## Validaciones realizadas

- Validación sintáctica con TypeScript `--noEmit` para App.jsx, main.jsx y Worker.
- Validación sintáctica del Worker con `node --check`.
- Prueba funcional aislada del Worker con consolidación histórica + dinámica y filtros.

## Build

No se pudo ejecutar `npm install` en este entorno porque el registro interno no dispone de `@vitejs/plugin-react@latest`. En una PC con acceso normal a npm:

```bash
npm install
npm run build
npm run dev
```
