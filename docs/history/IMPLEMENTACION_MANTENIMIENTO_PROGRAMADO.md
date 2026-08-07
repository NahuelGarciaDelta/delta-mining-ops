# Mantenimiento Programado — Delta Mining OPS

## Base de datos

Planilla utilizada:

`1jmTZ2_aJai-t1uj-sZB8MK1a6J47oXeiG5GIO_Gk6u4`

El Apps Script crea y configura automáticamente:

- `PM_CONFIG`: parámetros, último PM y horómetro base por equipo.
- `PM_REGISTROS`: historial de PM marcados como realizados.

## Puesta en marcha

1. Actualizar el Apps Script publicado con `backend/AppsScript.gs`.
2. Como alternativa segura para un Apps Script de producción más nuevo, crear un archivo `.gs` nuevo y pegar `backend/MantenimientoProgramado.gs`; luego agregar en `doGet` y `doPost` las rutas indicadas abajo.
3. Ejecutar manualmente una vez `setupMantenimientoProgramado_()` y autorizar el acceso a la planilla.
4. Volver a implementar la aplicación web de Apps Script como una versión nueva.
5. Publicar el frontend actualizado.

### Rutas para integrar en un Apps Script existente

En `doGet`, antes de validar acciones genéricas:

```javascript
if (action === "mantenimiento_programado" || action === "pm_programado") {
  return buildResponse(handleGetMantenimientoProgramado_());
}
```

En `doPost`:

```javascript
if (action === "save_pm_config") {
  return buildResponse(handleSavePMConfig_(payload.config || {}));
}

if (action === "registrar_pm_realizado") {
  return buildResponse(handleRegistrarPMRealizado_(payload.registro || {}));
}
```

Si el Apps Script utiliza versiones de datasets, agregar `pm_config` y `pm_registros` a `SHEETS_CONFIG`, como ya figura en `backend/AppsScript.gs`.

## Funcionamiento

- Intervalo objetivo predeterminado: 250 h.
- Desde 200 h: `PM PRÓXIMO`.
- Desde 350 h: `PM ATRASADO`.
- Antes de cargar una base para el último PM: `SIN BASE`.
- Al marcar `Realizado`, el horómetro ingresado pasa a ser el nuevo horómetro del último PM y desde allí comienza el siguiente ciclo.
- El horómetro actual se toma del máximo registrado en ROP02; también puede establecerse manualmente por equipo.

## Subpestañas iniciales

- Panel.
- Registrar realizado.
- Configuración.
- Historial.

Esta es una primera versión funcional preparada para continuar agregando check list, OT correctivos, filtros pendientes y catálogos de insumos del diseño HTML de referencia.
