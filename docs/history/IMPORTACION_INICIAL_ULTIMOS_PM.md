# Importación inicial de últimos PM

- Se incorporaron 56 registros válidos desde `Ultimos_PM_Equipos.xlsx`.
- La primera consulta a `action=mantenimiento_programado` completa automáticamente `PM_CONFIG`.
- No reemplaza valores que ya hayan sido cargados manualmente.
- También puede ejecutarse manualmente `setupMantenimientoProgramado_()` o `importarUltimosPMIniciales_()`.
- En el panel, la primera columna es el interno y la segunda muestra únicamente marca y modelo.
