# Mantenimiento Programado — actualización

- El módulo queda únicamente dentro del área **Mantenimiento**.
- Panel, Registrar realizado, Configuración e Historial funcionan como subpestañas internas.
- La flota se construye con equipos que registraron actividad ROP02 en los últimos 7 días.
- El horómetro actual se toma del último/mayor HF disponible por interno dentro de ese período.
- Se agregaron filtros por Proyecto, Tipo de máquina, Equipo, Propiedad y Estado.
- Las respuestas HTML del Apps Script ya no provocan `Unexpected token '<'`; se muestra un diagnóstico claro indicando que debe volver a implementarse la Web App.
- Para que GET/POST de PM funcionen, copiar `backend/AppsScript.gs` completo al proyecto de Apps Script y publicar una nueva versión de la aplicación web.
